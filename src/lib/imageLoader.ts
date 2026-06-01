/**
 * Loader de imagem custom do Next.
 *
 * Faz as imagens carregarem direto do CDN, sem passar pelo otimizador
 * `/_next/image` (que é lento no dev). Para Cloudinary, injeta uma transformação
 * on-the-fly (resize + formato/qualidade automáticos) na própria URL, mantendo a
 * otimização. Para Firebase Storage, caminhos locais ou outros, retorna a URL
 * original inalterada.
 */
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (src.includes("res.cloudinary.com") && src.includes("/upload/")) {
    const q = quality ?? "auto";
    return src.replace("/upload/", `/upload/f_auto,q_${q},w_${width}/`);
  }
  return src;
}
