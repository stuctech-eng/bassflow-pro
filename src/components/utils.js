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
      for (var i = 0; i < data.length; i += 4) {
        const helderheid = (data[i] + data[i+1] + data[i+2]) / 3;
        if (helderheid < drempel) {
          data[i] = 0; data[i+1] = 0; data[i+2] = 0;
        } else {
          data[i] = 255; data[i+1] = 255; data[i+2] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(function(blob) {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, "image/jpeg", 0.92);
    };
    img.src = url;
  });
}
