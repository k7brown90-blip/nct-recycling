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

function loadStoredPendingDraft(resellerId) {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem(`nct-reseller-pending-draft:${resellerId || "guest"}`);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (!parsed?.draftId) return null;

    return {
      draftId: String(parsed.draftId),
      createdAt: parsed.createdAt || null,
    };
  } catch {
    return null;
  }
}

function normalizeCartItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      productId: item?.productId || null,
      variantLegacyId: item?.variantLegacyId ? String(item.variantLegacyId) : null,
      quantity: Math.max(1, Math.min(Number(item?.quantity || 0), 99)),
    }))
    .filter((item) => item.productId && item.variantLegacyId && Number.isFinite(item.quantity));
}

export function useResellerCart(resellerId) {
  const cartStorageKey = `nct-reseller-cart:${resellerId || "guest"}`;
  const pendingDraftStorageKey = `nct-reseller-pending-draft:${resellerId || "guest"}`;
  const [cart, setCart] = useState(() => loadStoredCart(resellerId));
  const [pendingDraft, setPendingDraftState] = useState(() => loadStoredPendingDraft(resellerId));

  useEffect(() => {
    setCart(loadStoredCart(resellerId));
    setPendingDraftState(loadStoredPendingDraft(resellerId));
  }, [resellerId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {}
  }, [cart, cartStorageKey]);

  useEffect(() => {
    try {
      if (!pendingDraft) {
        window.localStorage.removeItem(pendingDraftStorageKey);
        return;
      }

      window.localStorage.setItem(pendingDraftStorageKey, JSON.stringify(pendingDraft));
    } catch {}
  }, [pendingDraft, pendingDraftStorageKey]);

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

  const replaceCart = useCallback((items) => {
    setCart(normalizeCartItems(items));
  }, []);

  const setPendingDraft = useCallback((draft) => {
    if (!draft?.draftId) {
      setPendingDraftState(null);
      return;
    }

    setPendingDraftState({
      draftId: String(draft.draftId),
      createdAt: draft.createdAt || null,
    });
  }, []);

  const clearPendingDraft = useCallback(() => {
    setPendingDraftState(null);
  }, []);

  return {
    cart,
    itemCount,
    pendingDraft,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    replaceCart,
    setPendingDraft,
    clearPendingDraft,
  };
}