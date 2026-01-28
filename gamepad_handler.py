"""
Gamepad Handler for SkillPlayer Quiz
Handles USB gamepad input using evdev (Linux only).
Maps gamepad buttons to quiz answer selections in diamond layout.
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
# These are EV_KEY codes for a typical USB gamepad
X_BTN = 288  # Top answer (index 0)
A_BTN = 291  # Right answer (index 1)
B_BTN = 290  # Bottom answer (index 2)
Y_BTN = 289  # Left answer (index 3)

# Map button codes to answer indices (diamond layout positions)
BUTTON_TO_ANSWER = {
    X_BTN: 0,  # Top
    A_BTN: 1,  # Right
    B_BTN: 2,  # Bottom
    Y_BTN: 3,  # Left
}


def find_gamepad_device():
    """Find gamepad device by name instead of hardcoding path."""
    if not EVDEV_AVAILABLE:
        return None
    
    try:
        devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in devices:
            # Look for device with "gamepad" in name (case insensitive)
            if 'gamepad' in device.name.lower():
                print(f"[Gamepad] Found device: {device.name} at {device.path}")
                return device.path
        
        # Fallback: also check for common gamepad identifiers
        for device in devices:
            name_lower = device.name.lower()
            if any(keyword in name_lower for keyword in ['joystick', 'controller', 'game']):
                print(f"[Gamepad] Found device: {device.name} at {device.path}")
                return device.path
        
        print("[Gamepad] No gamepad device found")
        return None
    except Exception as e:
        print(f"[Gamepad] Error scanning for devices: {e}")
        return None


class GamepadHandler:
    """Handles USB gamepad input and emits button presses via SocketIO."""
    
    def __init__(self, socketio):
        self.socketio = socketio
        self.running = True
        self.device_path = None
        
        # Start the listener thread
        self.listener_thread = threading.Thread(target=self._device_listener, daemon=True)
        self.listener_thread.start()
    
    def _device_listener(self):
        """Monitor gamepad device, auto-reconnecting on failure."""
        print("[Gamepad] Input listener started")
        
        while self.running:
            # Find the gamepad device
            self.device_path = find_gamepad_device()
            
            if not self.device_path:
                print("[Gamepad] No device found. Retrying in 5s...")
                time.sleep(5)
                continue
            
            try:
                device = evdev.InputDevice(self.device_path)
                print(f"[Gamepad] Connected: {device.name}")
                
                # Try to grab the device (optional, prevents other apps from seeing input)
                try:
                    device.grab()
                    print("[Gamepad] Device GRABBED")
                except Exception as e:
                    print(f"[Gamepad] Could not grab device: {e}")
                
                # Read events
                for event in device.read_loop():
                    if not self.running:
                        break
                    
                    # Only handle EV_KEY events (button presses)
                    if event.type == ecodes.EV_KEY:
                        # Only trigger on key DOWN (value == 1), ignore key UP (value == 0)
                        if event.value == 1:
                            if event.code in BUTTON_TO_ANSWER:
                                answer_index = BUTTON_TO_ANSWER[event.code]
                                print(f"[Gamepad] Button {event.code} pressed -> Answer {answer_index}")
                                
                                # Emit the button press to the frontend
                                self.socketio.emit('gamepad_button', {
                                    'answer_index': answer_index
                                })
                
            except (OSError, FileNotFoundError) as e:
                print(f"[Gamepad] Device disconnected: {e}. Retrying in 2s...")
                time.sleep(2)
            except Exception as e:
                print(f"[Gamepad] Unexpected error: {e}")
                time.sleep(2)
    
    def stop(self):
        """Stop the gamepad handler."""
        self.running = False


def start_gamepad_handler(socketio):
    """Factory function to create and start the gamepad handler."""
    if not EVDEV_AVAILABLE:
        print("[Gamepad] Cannot start handler - evdev not available")
        return None
    
    return GamepadHandler(socketio)
