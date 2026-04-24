"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function loadStoredCart(resellerId) {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(`nct-reseller-cart:${resellerId || "guest"}`);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useResellerCart(resellerId) {
  const cartStorageKey = `nct-reseller-cart:${resellerId || "guest"}`;
  const [cart, setCart] = useState(() => loadStoredCart(resellerId));

  useEffect(() => {
    setCart(loadStoredCart(resellerId));
  }, [resellerId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {}
  }, [cart, cartStorageKey]);

  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [cart]);

  const addItem = useCallback((productId, variantLegacyId) => {
    if (!productId || !variantLegacyId) return;

    setCart((current) => {
      const existing = current.find((entry) => entry.productId === productId && entry.variantLegacyId === variantLegacyId);
      if (existing) {
        return current.map((entry) => entry.productId === productId && entry.variantLegacyId === variantLegacyId
          ? { ...entry, quantity: Math.min(Number(entry.quantity || 0) + 1, 99) }
          : entry);
      }

      return current.concat({
        productId,
        variantLegacyId,
        quantity: 1,
      });
    });
  }, []);

  const updateQuantity = useCallback((productId, variantLegacyId, quantity) => {
    if (!productId || !variantLegacyId) return;

    if (quantity <= 0) {
      setCart((current) => current.filter((entry) => !(entry.productId === productId && entry.variantLegacyId === variantLegacyId)));
      return;
    }

    setCart((current) => current.map((entry) => entry.productId === productId && entry.variantLegacyId === variantLegacyId
      ? { ...entry, quantity: Math.min(quantity, 99) }
      : entry));
  }, []);

  const removeItem = useCallback((productId, variantLegacyId) => {
    setCart((current) => current.filter((entry) => !(entry.productId === productId && entry.variantLegacyId === variantLegacyId)));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  return {
    cart,
    itemCount,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  };
}