/**
 * Cắt giữa ảnh thành PNG vuông `size` px (dùng cho custom emoji).
 * shortcut: GIF/WebP động bị mất animation (canvas chỉ giữ frame đầu).
 */
export async function resizeImageToSquare(file: File, size = 128): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Could not read this image");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")
    ?.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Could not process this image");

  return new File([blob], "emoji.png", { type: "image/png" });
}
