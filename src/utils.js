export function verwerkFoto(file, drempel) {
  return new Promise(function(resolve) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Stap 1: bepaal achtergrondkleur (mediaan van hoekpixels)
      const hoekPixels = [
        [0, 0], [img.width - 1, 0],
        [0, img.height - 1], [img.width - 1, img.height - 1]
      ].map(function(pt) {
        const i = (pt[1] * img.width + pt[0]) * 4;
        return (data[i] + data[i+1] + data[i+2]) / 3;
      });
      const gemiddeldAchtergrond = hoekPixels.reduce(function(a, b) { return a + b; }, 0) / hoekPixels.length;

      // Stap 2: adaptieve drempel op basis van achtergrond
      const adaptieveDrempel = Math.min(drempel, gemiddeldAchtergrond * 0.85);

      // Stap 3: verwerk pixels
      for (var i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const helderheid = 0.299 * r + 0.587 * g + 0.114 * b;

        if (helderheid < adaptieveDrempel) {
          // Donker → zwart
          data[i] = 0; data[i+1] = 0; data[i+2] = 0;
        } else {
          // Licht → wit
          data[i] = 255; data[i+1] = 255; data[i+2] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(function(blob) {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, "image/jpeg", 0.95);
    };
    img.src = url;
  });
}
