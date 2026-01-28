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
X_BTN = 288  # Trigger/Left
Y_BTN = 289  # Thumb/Top
B_BTN = 290  # Thumb2/Right
A_BTN = 291  # Top/Bottom

# Map button codes to answer indices (diamond layout positions)
# User Report: Top->Left(3), Right->Top(0), Bottom->Right(1), Left->Bottom(2)
# Logic:
# Top sends 288 (was mapped to 3/Left). New Map: 288->0
# Right sends 289 (was mapped to 0/Top). New Map: 289->1
# Bottom sends 290 (was mapped to 1/Right). New Map: 290->2
# Left sends 291 (was mapped to 2/Bottom). New Map: 291->3
BUTTON_TO_ANSWER = {
    X_BTN: 0,  # Top
    Y_BTN: 1,  # Right
    B_BTN: 2,  # Bottom
    A_BTN: 3,  # Left
}


def find_all_gamepad_devices():
    """Find ALL gamepad devices named 'usb gamepad'."""
    if not EVDEV_AVAILABLE:
        return []
    
    gamepads = []
    try:
        current_devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in current_devices:
            # Only look for devices with "usb gamepad" in name (case insensitive)
            # Also check for common keywords in case the name is different
            name_lower = device.name.lower()
            if 'usb gamepad' in name_lower or 'joystick' in name_lower or 'controller' in name_lower or 'game' in name_lower:
                gamepads.append(device.path)
        
        return gamepads
    except Exception as e:
        print(f"[Gamepad] Error scanning for devices: {e}")
        return []


class GamepadHandler:
    """
    Handles USB gamepad input with session binding.
    """
    
    def __init__(self, socketio):
        self.socketio = socketio
        self.running = True
        
        # Session binding state
        self.waiting_for_bind = False
        self.active_device_path = None
        self.session_active = False
        
        # Track active device paths to avoid duplicate listeners
        self.active_listeners = set()
        self.lock = threading.Lock()
        
        # Start initial device scan
        self._scan_and_start_listeners()
        
        # Periodic rescan for new devices
        self.rescan_thread = threading.Thread(target=self._rescan_loop, daemon=True)
        self.rescan_thread.start()
    
    def start_binding_mode(self):
        """Enter binding mode - waiting for any gamepad button press."""
        print("[Gamepad] Entering binding mode - waiting for any button press")
        self.waiting_for_bind = True
        self.active_device_path = None
        self.session_active = False
    
    def end_session(self):
        """End the current session and reset binding."""
        print("[Gamepad] Session ended")
        self.waiting_for_bind = False
        self.active_device_path = None
        self.session_active = False
    
    def _scan_and_start_listeners(self):
        """Scan for devices and start listeners for new ones."""
        found_paths = find_all_gamepad_devices()
        
        with self.lock:
            for path in found_paths:
                if path not in self.active_listeners:
                    print(f"[Gamepad] New device found at {path}, starting listener...")
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
            print(f"[Gamepad] Connected: {device.name} at {device_path}")
            
            # Read events
            for event in device.read_loop():
                if not self.running:
                    break
                
                # Log EV_KEY for debugging
                if event.type == ecodes.EV_KEY:
                    print(f"[Gamepad] Raw: {event.code}, Val: {event.value}, Bound: {self.active_device_path}, Waiting: {self.waiting_for_bind}", flush=True)

                # Handle button presses (value=1)
                if event.type == ecodes.EV_KEY and event.value == 1:
                    self._handle_button_press(device_path, event.code)
            
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
    
    def _handle_button_press(self, device_path, button_code):
        """Handle a button press from any device."""
        
        # Mode 1: Waiting for binding
        if self.waiting_for_bind:
            print(f"[Gamepad] Device {device_path} claimed session with button {button_code}")
            self.active_device_path = device_path
            self.waiting_for_bind = False
            self.session_active = True
            
            self.socketio.emit('gamepad_bound', {
                'device_path': device_path
            })
            return
        
        # Mode 2: Session active
        if self.session_active:
            if device_path != self.active_device_path:
                return # Ignore other devices
            
            # Forward mapped buttons
            if button_code in BUTTON_TO_ANSWER:
                answer_index = BUTTON_TO_ANSWER[button_code]
                print(f"[Gamepad] Button {button_code} -> Answer {answer_index}")
                
                self.socketio.emit('gamepad_button', {
                    'answer_index': answer_index
                })
    
    def stop(self):
        """Stop the gamepad handler."""
        self.running = False


def start_gamepad_handler(socketio):
    """Factory function to create and start the gamepad handler."""
    if not EVDEV_AVAILABLE:
        print("[Gamepad] Cannot start handler - evdev not available")
        return None
    
    return GamepadHandler(socketio)
