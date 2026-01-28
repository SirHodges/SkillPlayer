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

# Button code mapping
# Button code mapping (User: X=288, B=290, A=291, Y=289)
X_BTN = 288  # Trigger/Left (Index 3)
Y_BTN = 289  # Thumb/Top (Index 0)
B_BTN = 290  # Thumb2/Right (Index 1)
A_BTN = 291  # Top/Bottom (Index 2)

# Map button codes to answer indices (diamond layout positions)
BUTTON_TO_ANSWER = {
    Y_BTN: 0,  # Top
    B_BTN: 1,  # Right
    A_BTN: 2,  # Bottom
    X_BTN: 3,  # Left
}


def find_all_gamepad_devices():
    """Find ALL gamepad devices named 'usb gamepad'."""
    if not EVDEV_AVAILABLE:
        return []
    
    gamepads = []
    try:
        for path in evdev.list_devices():
            device = evdev.InputDevice(path)
            # Only look for devices with "usb gamepad" in name (case insensitive)
            if 'usb gamepad' in device.name.lower():
                print(f"[Gamepad] Found device: {device.name} at {device.path}")
                gamepads.append(device.path)
        
        if not gamepads:
            print("[Gamepad] No 'usb gamepad' devices found")
        else:
            print(f"[Gamepad] Found {len(gamepads)} gamepad(s)")
        
        return gamepads
    except Exception as e:
        print(f"[Gamepad] Error scanning for devices: {e}")
        return []


class GamepadHandler:
    """
    Handles USB gamepad input with session binding.
    
    Flow:
    1. When waiting_for_bind=True, listens to ALL gamepads for any button press
    2. First gamepad to fire a button becomes the active_device for this session
    3. Only that device's inputs are forwarded until session ends
    """
    
    def __init__(self, socketio):
        self.socketio = socketio
        self.running = True
        
        # Session binding state
        self.waiting_for_bind = False
        self.active_device_path = None
        self.session_active = False
        
        # Thread management
        self.listener_threads = []
        self.devices = []
        
        # Start initial device scan
        self._start_device_listeners()
        
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
    
    def _start_device_listeners(self):
        """Start listener threads for all found gamepads."""
        device_paths = find_all_gamepad_devices()
        
        for path in device_paths:
            if path not in [d for d in self.devices]:
                self.devices.append(path)
                thread = threading.Thread(
                    target=self._device_listener, 
                    args=(path,), 
                    daemon=True
                )
                thread.start()
                self.listener_threads.append(thread)
    
    def _rescan_loop(self):
        """Periodically rescan for new gamepad devices."""
        while self.running:
            time.sleep(5)
            self._start_device_listeners()
    
    def _device_listener(self, device_path):
        """Monitor a single gamepad device."""
        print(f"[Gamepad] Listener started for {device_path}")
        
        while self.running:
            try:
                device = evdev.InputDevice(device_path)
                print(f"[Gamepad] Connected: {device.name} at {device_path}")
                
                # Read events
                print(f"[Gamepad] Reading events from {device.name}...")
                for event in device.read_loop():
                    if not self.running:
                        break
                    
                    # Log every key event for debugging
                    if event.type == ecodes.EV_KEY:
                        print(f"[Gamepad] Raw Event: {event.code}, Value: {event.value} bound={self.active_device_path}")

                    # Only handle EV_KEY events (button presses)
                    if event.type == ecodes.EV_KEY and event.value == 1:
                        self._handle_button_press(device_path, event.code)
                
            except (OSError, FileNotFoundError) as e:
                print(f"[Gamepad] Device {device_path} disconnected: {e}")
                # Remove from device list
                if device_path in self.devices:
                    self.devices.remove(device_path)
                break  # Exit thread, will be recreated on rescan
            except Exception as e:
                print(f"[Gamepad] Error on {device_path}: {e}")
                time.sleep(2)
    
    def _handle_button_press(self, device_path, button_code):
        """Handle a button press from any device."""
        
        # Mode 1: Waiting for binding - any button from any device binds it
        if self.waiting_for_bind:
            print(f"[Gamepad] Device {device_path} claimed session with button {button_code}")
            self.active_device_path = device_path
            self.waiting_for_bind = False
            self.session_active = True
            
            # Emit binding event to frontend
            self.socketio.emit('gamepad_bound', {
                'device_path': device_path
            })
            return
        
        # Mode 2: Session active - only accept input from bound device
        if self.session_active:
            if device_path != self.active_device_path:
                # Ignore input from other controllers
                return
            
            # Only forward X/Y/A/B buttons
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
