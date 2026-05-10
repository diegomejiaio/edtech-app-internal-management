"use client";

import { useState, useEffect, useRef } from "react";
import { useSpring, useTransform, useInView } from "framer-motion";

interface CountUpProps {
  target: number;
  delay?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function CountUp({
  target,
  delay = 0,
  duration = 1.2,
  className = "",
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // once: true — anima solo la primera vez que entra al viewport
  const isInView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const display = useTransform(spring, (value) => Math.round(value));
  const [displayValue, setDisplayValue] = useState(0);

  // Dispara el conteo solo cuando el elemento es visible en el viewport
  useEffect(() => {
    if (!isInView) return;

    const timer = setTimeout(() => {
      spring.set(target);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [isInView, target, delay, spring]);

  // Suscribe a cambios del spring para actualizar el valor visible
  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      setDisplayValue(v);
    });
    return () => unsubscribe();
  }, [display]);

  // Resetear si el target cambia (ej: cambio de período o empresa)
  useEffect(() => {
    spring.jump(0);
    setDisplayValue(0);
    if (isInView) {
      const timer = setTimeout(() => {
        spring.set(target);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayValue.toLocaleString("es-PE")}
      {suffix}
    </span>
  );
}
