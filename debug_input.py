import evdev
import sys

print("--- Evdev Input Debugger ---")

# List devices
devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
print(f"Found {len(devices)} input devices:")

gamepad_devices = []

for device in devices:
    print(f"- {device.path}: {device.name}")
    print(f"  Physical: {device.phys}")
    
    # Check if it looks like a gamepad
    name_lower = device.name.lower()
    if 'usb gamepad' in name_lower or 'joystick' in name_lower or 'controller' in name_lower or 'game' in name_lower:
        gamepad_devices.append(device)

if not gamepad_devices:
    print("\nNo obvious gamepad devices found!")
    print("If you see your device in the list above, run this script with the path:")
    print(f"python3 debug_input.py /dev/input/eventX")
    sys.exit(1)

print(f"\nPotential gamepads found: {len(gamepad_devices)}")
target_device = gamepad_devices[0]

# Allow overriding device via command line
if len(sys.argv) > 1:
    try:
        target_device = evdev.InputDevice(sys.argv[1])
    except Exception as e:
        print(f"Error opening {sys.argv[1]}: {e}")
        sys.exit(1)

print(f"\nListening to: {target_device.name} ({target_device.path})")
print("Press buttons on your controller. You should see events below.")
print("Press Ctrl+C to exit.")
print("-" * 30)

try:
    for event in target_device.read_loop():
        # Print all useful events
        if event.type == evdev.ecodes.EV_KEY:
            print(f"KEY EVENT: Code={event.code} ({evdev.ecodes.keys.get(event.code)}), Value={event.value}")
        elif event.type == evdev.ecodes.EV_ABS:
            print(f"ABS EVENT: Code={event.code}, Value={event.value}")
        elif event.type == evdev.ecodes.EV_MSC:
            pass # Ignore misc sync events usually
        else:
            print(f"OTHER: Type={event.type}, Code={event.code}, Value={event.value}")
except KeyboardInterrupt:
    print("\nExiting...")
except Exception as e:
    print(f"\nError: {e}")
