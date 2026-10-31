using UnityEngine;
using UnityEngine.InputSystem;

namespace MetaSpace.World
{
    /// <summary>
    /// Caminar y mirar en primera persona.
    ///
    /// Primera persona y no tercera porque el paquete de modelos no trae una
    /// sola animacion: un personaje sin animar se desliza en pose de maniquI.
    /// Ademas encaja con el casco, y la ciudad impone mas mirandola desde abajo.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class FirstPersonController : MonoBehaviour
    {
        public float walkSpeed = 3.2f;
        public float runSpeed = 6.4f;
        public float lookSensitivity = 0.08f;
        public float gravity = -18f;
        public Transform head;

        CharacterController controller;
        float pitch;
        float verticalSpeed;

        void Awake()
        {
            controller = GetComponent<CharacterController>();
            if (head == null && Camera.main != null) head = Camera.main.transform;
        }

        void Update()
        {
            var keyboard = Keyboard.current;
            var mouse = Mouse.current;
            if (keyboard == null) return;

            // El puntero se captura al hacer clic: en WebGL el navegador solo
            // concede el bloqueo tras un gesto del usuario, nunca al cargar.
            if (mouse != null && mouse.leftButton.wasPressedThisFrame &&
                Cursor.lockState != CursorLockMode.Locked)
            {
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }

            if (keyboard.escapeKey.wasPressedThisFrame)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }

            Look(mouse);
            Move(keyboard);
        }

        void Look(Mouse mouse)
        {
            if (mouse == null || Cursor.lockState != CursorLockMode.Locked) return;

            var delta = mouse.delta.ReadValue() * lookSensitivity;

            transform.Rotate(Vector3.up, delta.x, Space.World);

            pitch = Mathf.Clamp(pitch - delta.y, -85f, 85f);
            if (head != null) head.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }

        void Move(Keyboard keyboard)
        {
            float x = 0f, z = 0f;
            if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) x -= 1f;
            if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) x += 1f;
            if (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed) z -= 1f;
            if (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed) z += 1f;

            float speed = keyboard.leftShiftKey.isPressed ? runSpeed : walkSpeed;
            var move = Vector3.ClampMagnitude(transform.right * x + transform.forward * z, 1f) * speed;

            if (controller.isGrounded && verticalSpeed < 0f) verticalSpeed = -2f;
            verticalSpeed += gravity * Time.deltaTime;

            controller.Move((move + Vector3.up * verticalSpeed) * Time.deltaTime);
        }
    }
}
