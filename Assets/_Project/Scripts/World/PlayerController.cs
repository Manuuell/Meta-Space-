using UnityEngine;
using UnityEngine.InputSystem;

namespace MetaSpace.World
{
    /// <summary>
    /// Movimiento lateral del astronauta. Lee el teclado con el Input System,
    /// no con UnityEngine.Input: con el paquete activo, el sistema antiguo deja
    /// de entregar pulsaciones sin avisar de nada.
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D))]
    public class PlayerController : MonoBehaviour
    {
        public float walkSpeed = 3.4f;
        public float jumpSpeed = 7.2f;
        public float groundCheckDistance = 0.12f;
        public LayerMask groundLayers = ~0;

        Rigidbody2D body;
        SpriteRenderer sprite;
        Collider2D footprint;

        public bool Grounded { get; private set; }
        public bool ControlsLocked { get; set; }

        void Awake()
        {
            body = GetComponent<Rigidbody2D>();
            sprite = GetComponentInChildren<SpriteRenderer>();
            footprint = GetComponent<Collider2D>();

            // Un traje presurizado no es un personaje de plataformas: no rota,
            // no rebota y no se queda enganchado en las esquinas del terreno.
            body.freezeRotation = true;
            body.gravityScale = 2.6f;
            body.interpolation = RigidbodyInterpolation2D.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        }

        void Update()
        {
            var keyboard = Keyboard.current;
            if (keyboard == null) return;

            Grounded = CheckGround();

            if (ControlsLocked)
            {
                body.linearVelocity = new Vector2(0f, body.linearVelocity.y);
                return;
            }

            float move = 0f;
            if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) move -= 1f;
            if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) move += 1f;

            body.linearVelocity = new Vector2(move * walkSpeed, body.linearVelocity.y);

            if (move != 0f && sprite != null)
                sprite.flipX = move < 0f;

            bool jumpPressed = keyboard.spaceKey.wasPressedThisFrame ||
                               keyboard.wKey.wasPressedThisFrame ||
                               keyboard.upArrowKey.wasPressedThisFrame;

            if (jumpPressed && Grounded)
                body.linearVelocity = new Vector2(body.linearVelocity.x, jumpSpeed);
        }

        bool CheckGround()
        {
            if (footprint == null) return false;

            var bounds = footprint.bounds;
            var origin = new Vector2(bounds.center.x, bounds.min.y + 0.02f);
            var size = new Vector2(bounds.size.x * 0.9f, 0.06f);

            return Physics2D.BoxCast(origin, size, 0f, Vector2.down,
                                     groundCheckDistance, groundLayers).collider != null;
        }
    }
}
