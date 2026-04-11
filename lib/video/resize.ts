/**
 * 调整图片尺寸以匹配目标分辨率
 * 使用 Canvas 进行居中裁剪
 */
export async function resizeImageToTarget(
  file: File,
  targetWidth: number,
  targetHeight: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // 释放 Blob URL，避免内存泄漏
      URL.revokeObjectURL(img.src)

      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("无法创建 Canvas 上下文"))
        return
      }

      const srcRatio = img.width / img.height
      const targetRatio = targetWidth / targetHeight

      let sx = 0, sy = 0, sw = img.width, sh = img.height

      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio
        sx = (img.width - sw) / 2
      } else {
        sh = img.width / targetRatio
        sy = (img.height - sh) / 2
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("图片转换失败"))
            return
          }
          const resizedFile = new File([blob], file.name, {
            type: file.type || "image/jpeg",
            lastModified: Date.now(),
          })
          resolve(resizedFile)
        },
        file.type || "image/jpeg",
        0.92
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error("图片加载失败"))
    }
    img.src = URL.createObjectURL(file)
  })
}
