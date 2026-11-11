// Borrar la cuenta sin la app: entrar (contraseña o código del correo) y llamar a la misma
// función de la base de datos que usa la app, `delete_my_account`.
(function () {
  const { supabaseUrl, supabaseKey } = window.CUIDARED;
  // Sin guardar la sesión en el navegador: solo vive mientras la página está abierta.
  const client = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const $ = (id) => document.getElementById(id);

  const conContrasena = $('con-contrasena');
  const conCodigo = $('con-codigo');
  const confirmar = $('confirmar');
  const mensaje = $('mensaje');

  function avisar(texto, tipo = 'error') {
    mensaje.textContent = texto;
    mensaje.className = `mensaje ${tipo}`;
    mensaje.hidden = false;
    mensaje.focus();
  }
  function limpiar() {
    mensaje.hidden = true;
    mensaje.textContent = '';
  }
  // Mientras espera al servidor, los botones del formulario no se pueden volver a pulsar.
  async function ocupado(boton, accion) {
    boton.disabled = true;
    try {
      await accion();
    } catch {
      avisar('No hemos podido conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      boton.disabled = false;
    }
  }
  function mostrarConfirmacion(email) {
    conContrasena.hidden = true;
    conCodigo.hidden = true;
    $('cuenta').textContent = email;
    $('entiendo').checked = false;
    confirmar.hidden = false;
    $('confirmar-titulo').focus();
  }

  conContrasena.addEventListener('submit', (e) => {
    e.preventDefault();
    limpiar();
    const email = $('correo').value.trim();
    const password = $('contrasena').value;
    if (!email || !password) return avisar('Escribe tu correo y tu contraseña.');
    ocupado(conContrasena.querySelector('button[type=submit]'), async () => {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return avisar('El correo o la contraseña no son correctos.');
      mostrarConfirmacion(data.user.email);
    });
  });

  $('olvidada').addEventListener('click', () => {
    limpiar();
    conContrasena.hidden = true;
    conCodigo.hidden = false;
    $('correo-codigo').value = $('correo').value;
    $('correo-codigo').focus();
  });
  $('volver-contrasena').addEventListener('click', () => {
    limpiar();
    conCodigo.hidden = true;
    conContrasena.hidden = false;
    $('correo').focus();
  });

  $('enviar-codigo').addEventListener('click', (e) => {
    limpiar();
    const email = $('correo-codigo').value.trim();
    if (!email) return avisar('Escribe tu correo.');
    ocupado(e.currentTarget, async () => {
      // Responde igual exista o no la cuenta (no se revela quién está registrado).
      await client.auth.resetPasswordForEmail(email);
      $('paso-codigo').hidden = false;
      avisar('Si hay una cuenta con ese correo, te hemos enviado un código. Mira también en el correo no deseado.', 'ok');
      $('codigo').focus();
    });
  });

  conCodigo.addEventListener('submit', (e) => {
    e.preventDefault();
    limpiar();
    const email = $('correo-codigo').value.trim();
    const token = $('codigo').value.replace(/\D/g, '');
    if (token.length !== 6) return avisar('El código tiene 6 cifras.');
    ocupado(conCodigo.querySelector('button[type=submit]'), async () => {
      const { data, error } = await client.auth.verifyOtp({ email, token, type: 'recovery' });
      if (error || !data.user) return avisar('El código no es correcto o ha caducado. Pide uno nuevo.');
      mostrarConfirmacion(data.user.email);
    });
  });

  $('cancelar').addEventListener('click', async () => {
    limpiar();
    await client.auth.signOut();
    confirmar.hidden = true;
    conContrasena.hidden = false;
    $('contrasena').value = '';
    $('correo').focus();
  });

  $('borrar').addEventListener('click', (e) => {
    limpiar();
    if (!$('entiendo').checked) return avisar('Marca la casilla para confirmar que quieres borrar la cuenta.');
    ocupado(e.currentTarget, async () => {
      const { data, error } = await client.rpc('delete_my_account');
      if (error) return avisar('No hemos podido borrar tu cuenta. Revisa tu conexión e inténtalo de nuevo.');
      if (data && data.error === 'sole_coordinator') {
        const nombres = (data.circles || []).map((c) => c.name).join(', ');
        return avisar(
          `Eres la única persona que coordina estos círculos: ${nombres}. Antes de borrar tu cuenta, da la coordinación a otra persona (en la app, «Personas») o borra el círculo.`,
        );
      }
      // La cuenta ya no existe: la sesión deja de valer.
      await client.auth.signOut({ scope: 'local' });
      confirmar.hidden = true;
      avisar('Tu cuenta se ha borrado. Gracias por haber usado CuidaRed.', 'ok');
    });
  });
})();
