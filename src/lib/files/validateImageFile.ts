/**
 * Valida que um `File` escolhido em um `<input type="file" accept="image/*">` é de fato uma
 * imagem decodificável — o atributo `accept` é só um filtro de UI (o navegador não impede
 * arrastar/soltar ou automação de enviar qualquer arquivo, inclusive um .txt renomeado para
 * .jpg ou um arquivo de 0 bytes). Sem isso o upload aceitava qualquer coisa, contava como
 * "foto preenchida" e só quebrava silenciosamente depois, como uma miniatura de largura 0.
 *
 * Usa `createImageBitmap` (suportado em todos os navegadores relevantes do projeto) para tentar
 * decodificar de verdade — rejeita bytes que não formam uma imagem válida, sem depender só da
 * extensão do arquivo ou do `file.type` (ambos fáceis de forjar).
 */
export async function validateImageFile(file: File): Promise<{ valid: true } | { valid: false; reason: string }> {
  if (file.size === 0) {
    return { valid: false, reason: 'Arquivo vazio (0 bytes). Escolha uma foto válida.' }
  }

  try {
    const bitmap = await createImageBitmap(file)
    bitmap.close()
    return { valid: true }
  } catch {
    return { valid: false, reason: 'Arquivo não é uma imagem válida. Escolha uma foto (JPEG, PNG, WebP).' }
  }
}
