/**
 * Template HTML do e-mail de redefinição de senha.
 * Usa estilos inline (obrigatório para clientes de e-mail) com a identidade
 * visual da Shark SmokeHouse.
 */
export function passwordResetEmail(params: {
  resetLink: string;
  appUrl: string;
  logoUrl: string;
}): { subject: string; html: string; text: string } {
  const { resetLink, appUrl, logoUrl } = params;

  const subject = "Redefinição de senha · Shark SmokeHouse";

  const text = [
    "Recebemos um pedido para redefinir a senha da sua conta na Shark SmokeHouse.",
    "",
    "Abra o link abaixo para criar uma nova senha (válido por 1 hora):",
    resetLink,
    "",
    "Se você não solicitou isso, pode ignorar este e-mail com segurança.",
    "",
    "Shark SmokeHouse",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#08080f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:linear-gradient(180deg,#0a0f1e 0%,#08080f 100%);border:1px solid rgba(0,212,255,0.18);border-radius:20px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:36px 32px 8px 32px;">
              <img src="${logoUrl}" alt="Shark SmokeHouse" width="72" height="72" style="display:block;border-radius:50%;border:2px solid rgba(0,212,255,0.3);" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 0 32px;">
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Redefinição de senha</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:16px 36px 8px 36px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#b8c0cc;">
                Recebemos um pedido para redefinir a senha da sua conta na
                <strong style="color:#ffffff;">Shark SmokeHouse</strong>.
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#b8c0cc;">
                Clique no botão abaixo para criar uma nova senha. O link é válido por
                <strong style="color:#00d4ff;">1 hora</strong>.
              </p>
            </td>
          </tr>
          <!-- Button -->
          <tr>
            <td align="center" style="padding:0 36px 28px 36px;">
              <a href="${resetLink}" target="_blank"
                 style="display:inline-block;background:linear-gradient(135deg,#2563ff,#00d4ff);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;">
                Redefinir minha senha
              </a>
            </td>
          </tr>
          <!-- Fallback link -->
          <tr>
            <td style="padding:0 36px 24px 36px;">
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#6b7280;">
                Se o botão não funcionar, copie e cole este endereço no navegador:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${resetLink}" target="_blank" style="color:#00d4ff;text-decoration:none;">${resetLink}</a>
              </p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background-color:rgba(255,255,255,0.08);"></div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 32px 36px;">
              <p style="margin:0 0 4px 0;font-size:12px;line-height:1.6;color:#6b7280;">
                Se você não solicitou a redefinição, pode ignorar este e-mail com segurança — sua senha não será alterada.
              </p>
              <p style="margin:12px 0 0 0;font-size:12px;color:#4b5563;">
                <a href="${appUrl}" target="_blank" style="color:#6b7280;text-decoration:none;">Shark SmokeHouse</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
