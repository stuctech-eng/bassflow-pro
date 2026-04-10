import { useState, useEffect } from "react";

export function useOrientation() {
  const [landscape, setLandscape] = useState(window.innerWidth > window.innerHeight);
  useEffect(function() {
    function check() {
      setTimeout(function() {
        setLandscape(window.innerWidth > window.innerHeight);
      }, 150);
    }
    const interval = setInterval(function() {
      const isLandscape = window.innerWidth > window.innerHeight;
      setLandscape(function(prev) { return prev !== isLandscape ? isLandscape : prev; });
    }, 300);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", check);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return function() {
      clearInterval(interval);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", check);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  return landscape;
}
