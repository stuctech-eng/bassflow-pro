import { useState, useEffect } from "react";

export function useOrientation() {
  const [landscape, setLandscape] = useState(
    window.screen.orientation ? window.screen.orientation.angle === 90 || window.screen.orientation.angle === 270 : window.innerWidth > window.innerHeight
  );

  useEffect(function() {
    function check() {
      setTimeout(function() {
        const isLandscape = window.screen.orientation
          ? window.screen.orientation.angle === 90 || window.screen.orientation.angle === 270
          : window.innerWidth > window.innerHeight;
        setLandscape(isLandscape);
      }, 200);
    }

    if (window.screen.orientation) {
      window.screen.orientation.addEventListener("change", check);
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", check);
    }
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    return function() {
      if (window.screen.orientation) {
        window.screen.orientation.removeEventListener("change", check);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", check);
      }
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  return landscape;
}
