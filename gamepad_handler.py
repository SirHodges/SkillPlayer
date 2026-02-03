"""
Gamepad Handler for SkillPlayer Quiz
Handles USB gamepad input using evdev (Linux only).
Supports multi-gamepad detection with session binding - first button press binds that controller.
"""

import threading
import time

# Try to import evdev - only available on Linux
try:
    import evdev
    from evdev import ecodes
    EVDEV_AVAILABLE = True
except ImportError:
    EVDEV_AVAILABLE = False
    print("[Gamepad] evdev not available (Windows). Gamepad support disabled.")

# Button code mapping (User: X=288, B=290, A=291, Y=289)
# Primary (USB Gamepad)
X_BTN = 288  # Trigger/Left
Y_BTN = 289  # Thumb/Top
B_BTN = 290  # Thumb2/Right
A_BTN = 291  # Top/Bottom

# Secondary (8Bitdo SF30 Pro)
# User Report: X=307, A=305, B=304, Y=306
SF30_X = 307
SF30_A = 305
SF30_B = 304
SF30_Y = 306

# Map button codes to answer indices (diamond layout positions)
# Note: Layout is generic, works for both 1P and 2P
# Button code mapping
START_BTN = 297
SELECT_BTN = 296
LEFT_TRIGGER = 292
RIGHT_TRIGGER = 293

# Map button codes to answer indices or actions
# Map button codes to answer indices or actions
BUTTON_TO_ANSWER = {
    # USB Gamepad Mappings
    X_BTN: 0,  # Top
    Y_BTN: 1,  # Right
    B_BTN: 2,  # Bottom
    A_BTN: 3,  # Left
    RIGHT_TRIGGER: 'skip',
    
    # 8Bitdo SF30 Pro Mappings
    SF30_X: 0, 
    SF30_A: 1, 
    SF30_B: 2, 
    SF30_Y: 3, 
}


def find_all_gamepad_devices():
    """Find ALL gamepad devices named 'usb gamepad' or similar."""
    if not EVDEV_AVAILABLE:
        return []
    
    gamepads = []
    try:
        current_devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in current_devices:
            # Only look for devices with "usb gamepad" in name (case insensitive)
            # Also check for common keywords in case the name is different
            name_lower = device.name.lower()
            if 'usb gamepad' in name_lower or 'joystick' in name_lower or 'controller' in name_lower or 'game' in name_lower or '8bitdo' in name_lower:
                gamepads.append(device.path)
        
        return gamepads
    except Exception as e:
        print(f"[Gamepad] Error scanning for devices: {e}")
        return []


class GamepadHandler:
    """
    Handles USB gamepad input for 1 or 2 players.
    """
    
    def __init__(self, socketio):
        self.socketio = socketio
        self.running = True
        
        # Session binding state
        # players = {1: device_path, 2: device_path}
        self.players = {1: None, 2: None}
        self.binding_mode = False # False, 'P1', or 'P2'
        self.session_active = False
        self.multimode = False # True if looking for 2 players
        
        # Track active device paths to avoid duplicate listeners
        self.active_listeners = set()
        self.lock = threading.Lock()
        
        # Start initial device scan
        self._scan_and_start_listeners()
        
        # Periodic rescan for new devices
        self.rescan_thread = threading.Thread(target=self._rescan_loop, daemon=True)
        self.rescan_thread.start()
    
    def log(self, message):
        """Log message to console and emit to frontend admin terminal."""
        print(message, flush=True)
        # Emit to all connected clients
        self.socketio.emit('server_log', {'message': message, 'timestamp': time.strftime('%H:%M:%S')})
    
    def start_binding_mode(self, player_target='P1', multi=False):
        """Enter binding mode for a specific player target."""
        print(f"[Gamepad] Entering binding mode for {player_target} (Multi: {multi})")
        self.binding_mode = player_target
        self.multimode = multi
        
        # Reset if starting fresh P1 bind
        if player_target == 'P1':
            self.players = {1: None, 2: None}
            self.session_active = False
            
    def end_session(self):
        """End the current session and reset binding."""
        print("[Gamepad] Session ended")
        self.binding_mode = False
        self.players = {1: None, 2: None}
        self.session_active = False
    
    def _scan_and_start_listeners(self):
        """Scan for devices and start listeners for new ones."""
        found_paths = find_all_gamepad_devices()
        
        with self.lock:
            for path in found_paths:
                if path not in self.active_listeners:
                    self.log(f"[Gamepad] New device found at {path}, starting listener...")
                    self.active_listeners.add(path)
                    thread = threading.Thread(
                        target=self._device_listener, 
                        args=(path,), 
                        daemon=True
                    )
                    thread.start()
    
    def _rescan_loop(self):
        """Periodically rescan for new gamepad devices."""
        while self.running:
            time.sleep(5)
            self._scan_and_start_listeners()
    
    def _device_listener(self, device_path):
        """Monitor a single gamepad device."""
        print(f"[Gamepad] Listener thread started for {device_path}")
        
        try:
            device = evdev.InputDevice(device_path)
            self.log(f"[Gamepad] Connected: {device.name} at {device_path}")
            
            # Read events
            for event in device.read_loop():
                if not self.running:
                    break
                
                # Log EV_KEY for debugging
                if event.type == ecodes.EV_KEY:
                    # Verbose logging (optional, maybe too noisy for admin console, but standard print ok)
                    # Use standard print for raw spam, log() for key events
                    print(f"[Gamepad] Raw: {event.code}, Val: {event.value}", flush=True)

                # Handle button events (press=1, release=0, hold=2)
                if event.type == ecodes.EV_KEY:
                    if event.value in [0, 1]: # Ignore hold (2) auto-repeat events for now
                        self._handle_button_event(device_path, event.code, event.value)
            
        except (OSError, FileNotFoundError) as e:
            print(f"[Gamepad] Device {device_path} disconnected: {e}")
        except Exception as e:
            print(f"[Gamepad] Error on {device_path}: {e}")
        finally:
            # Clean up when thread exits
            with self.lock:
                if device_path in self.active_listeners:
                    self.active_listeners.remove(device_path)
            print(f"[Gamepad] Listener thread ended for {device_path}")
    
    def _handle_button_event(self, device_path, button_code, value):
        """Handle a button event (press/release) from any device."""
        
        # --- BINDING LOGIC (Press Only) ---
        if self.binding_mode and value == 1:
            # Check for P1 Binding
            if self.binding_mode == 'P1':
                print(f"[Gamepad] Device {device_path} claimed Player 1")
                self.players[1] = device_path
                self.socketio.emit('gamepad_bound', {'player': 1, 'device_path': device_path})
                
                if self.multimode:
                    # Switch to waiting for P2
                    self.binding_mode = 'P2'
                    print("[Gamepad] Now waiting for Player 2...")
                else:
                    # Single player done
                    self.binding_mode = False
                    self.session_active = True
                return

            # Check for P2 Binding
            elif self.binding_mode == 'P2':
                # Prevent P1 device from claiming P2 slot
                if device_path == self.players[1]:
                    print("[Gamepad] Ignored P1 device for P2 slot")
                    return
                
                print(f"[Gamepad] Device {device_path} claimed Player 2")
                self.players[2] = device_path
                self.socketio.emit('gamepad_bound', {'player': 2, 'device_path': device_path})
                
                # All done
                self.binding_mode = False
                self.session_active = True
                return

        # --- GAMEPLAY LOGIC ---
        if self.session_active:
            # Identify player
            player_id = 0
            if device_path == self.players[1]:
                player_id = 1
            elif device_path == self.players[2]:
                player_id = 2
            
            if player_id > 0:
                # 1. Handle Special Hold-to-Stop Button (START)
                if button_code == START_BTN:
                    if value == 1: # Down
                         self.log(f"[Gamepad] Player {player_id} START DOWN (Holding...)")
                         self.socketio.emit('gamepad_start_down', {'player': player_id})
                    elif value == 0: # Up
                         self.log(f"[Gamepad] Player {player_id} START UP (Released)")
                         self.socketio.emit('gamepad_start_up', {'player': player_id})
                    return # Start button is special, don't map to answers

                # 2. Handle Standard Answer Buttons (Press Only)
                if value == 1:
                    # Forward mapped buttons
                    if button_code in BUTTON_TO_ANSWER:
                        answer_index = BUTTON_TO_ANSWER[button_code]
                        self.log(f"[Gamepad] Player {player_id} pressed Button {button_code} -> Answer {answer_index}")
                        
                        if answer_index == 'skip':
                            self.log("[Gamepad] SKIP EVENT EMITTED!")

                        self.socketio.emit('gamepad_button', {
                            'player': player_id,
                            'answer_index': answer_index
                        })
                    else:
                        print(f"[Gamepad] Unmapped Button Pressed: {button_code}")
    
    def stop(self):
        """Stop the gamepad handler."""
        self.running = False


def start_gamepad_handler(socketio):
    """Factory function to create and start the gamepad handler."""
    if not EVDEV_AVAILABLE:
        print("[Gamepad] Cannot start handler - evdev not available")
        return None
    
    return GamepadHandler(socketio)
