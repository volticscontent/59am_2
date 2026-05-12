'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/utils/products';

interface BundleContextType {
  isBundleActive: boolean;
  bundleSize: number;
  selectedItems: (Product | null)[];
  currentSlot: number | null;
  setCurrentSlot: (slot: number | null) => void;
  returnToHandle: string | null;
  setReturnToHandle: (handle: string | null) => void;
  startBundle: (size: number, initialProduct?: Product) => void;
  initBundleWithItems: (size: number, items: Product[]) => void;
  updateBundleSize: (size: number) => void;


  selectProduct: (product: Product) => void;
  removeProduct: (index: number) => void;
  removeProductByHandle: (handle: string) => void;
  clearBundle: () => void;
  isComplete: boolean;
}

const BundleContext = createContext<BundleContextType | undefined>(undefined);

export const BundleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBundleActive, setIsBundleActive] = useState(false);
  const [bundleSize, setBundleSize] = useState(3);
  const [selectedItems, setSelectedItems] = useState<(Product | null)[]>([]);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [returnToHandle, setReturnToHandle] = useState<string | null>(null);
  const router = useRouter();


  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bundleConfig');
    if (saved) {
      const { size, items, active, slot } = JSON.parse(saved);
      setBundleSize(size);
      setSelectedItems(items);
      setIsBundleActive(active);
      setCurrentSlot(slot);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isBundleActive) {
      localStorage.setItem('bundleConfig', JSON.stringify({
        size: bundleSize,
        items: selectedItems,
        active: isBundleActive,
        slot: currentSlot
      }));
    } else {
      localStorage.removeItem('bundleConfig');
    }
  }, [isBundleActive, bundleSize, selectedItems, currentSlot]);

  const startBundle = (size: number, initialProduct?: Product) => {
    setBundleSize(size);
    const items = new Array(size).fill(null);
    if (initialProduct) {
      items[0] = initialProduct;
      setCurrentSlot(1);
    } else {
      setCurrentSlot(0);
    }
    setSelectedItems(items);
    setIsBundleActive(true);
    router.push('/?bundleActive=true', { scroll: false });
  };

  // Initialise bundle with all items pre-filled (no routing side effects)
  const initBundleWithItems = (size: number, items: Product[]) => {
    setBundleSize(size);
    const slots: (Product | null)[] = new Array(size).fill(null);
    items.forEach((p, i) => {
      if (i < size) slots[i] = p;
    });
    setSelectedItems(slots);
    setCurrentSlot(null);
    setReturnToHandle(items[0]?.handle || null);
    setIsBundleActive(true);
  };

  const updateBundleSize = (newSize: number) => {
    setBundleSize(newSize);
    setSelectedItems(prev => {
      const newItems = new Array(newSize).fill(null);
      prev.forEach((item, i) => {
        if (i < newSize) {
          newItems[i] = item;
        }
      });
      
      // Calculate next slot inside the update function to ensure consistency
      const firstEmpty = newItems.findIndex(item => item === null);
      setCurrentSlot(firstEmpty !== -1 ? firstEmpty : null);
      
      return newItems;
    });
    setIsBundleActive(true);
  };


  const selectProduct = (product: Product) => {
    // PRIORIDADE MÁXIMA: Tapar buracos (slots nulos)
    const firstEmpty = selectedItems.findIndex(item => item === null);
    
    let targetSlot = currentSlot;
    
    // Se houver qualquer buraco, o próximo perfume selecionado DEVE ir para lá, SEMPRE.
    if (firstEmpty !== -1) {
      targetSlot = firstEmpty;
    }

    if (targetSlot === null) return;

    const newItems = [...selectedItems];
    newItems[targetSlot] = product;
    setSelectedItems(newItems);

    // Se estiver editando o primeiro perfume (slot 0), atualiza o returnToHandle
    if (targetSlot === 0) {
      setReturnToHandle(product.handle);
    }

    // Encontrar o próximo slot vazio após a inserção
    const nextSlot = newItems.findIndex(item => item === null);
    if (nextSlot !== -1) {
      setCurrentSlot(nextSlot);
      router.push('/?bundleActive=true', { scroll: false }); 
    } else {
      setCurrentSlot(null);
      const targetHandle = (targetSlot === 0 ? product.handle : returnToHandle) || newItems[0]?.handle;
      if (targetHandle) {
        router.push(`/products/${targetHandle}?bundleComplete=true`);
      }
    }
  };





  const removeProduct = (index: number) => {
    const newItems = [...selectedItems];
    newItems[index] = null;
    setSelectedItems(newItems);
    setCurrentSlot(index);
  };

  const removeProductByHandle = (handle: string) => {
    const newItems = selectedItems.map(item =>
      item?.handle === handle ? null : item
    );
    setSelectedItems(newItems);
    const firstNull = newItems.findIndex(item => item === null);
    if (firstNull !== -1) setCurrentSlot(firstNull);
  };

  const clearBundle = () => {
    setIsBundleActive(false);
    setBundleSize(3);
    setSelectedItems([]);
    setCurrentSlot(null);
    localStorage.removeItem('bundleConfig');
  };

  const isComplete = selectedItems.every(item => item !== null);

  return (
    <BundleContext.Provider value={{
      isBundleActive,
      bundleSize,
      selectedItems,
      currentSlot,
      setCurrentSlot,
      returnToHandle,
      setReturnToHandle,
      startBundle,
      initBundleWithItems,
      updateBundleSize,


      selectProduct,
      removeProduct,
      removeProductByHandle,
      clearBundle,
      isComplete
    }}>
      {children}
    </BundleContext.Provider>
  );
};

export const useBundle = () => {
  const context = useContext(BundleContext);
  if (context === undefined) {
    throw new Error('useBundle must be used within a BundleProvider');
  }
  return context;
};
