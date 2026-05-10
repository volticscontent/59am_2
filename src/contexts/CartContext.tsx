'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useTracking } from '@/contexts/UTMContext';

export interface CartItem {
  handle: string;
  variant_id: number;
  product_id: number;
  title: string;
  price: string;
  quantity: number;
  image?: string;
  bundleItems?: any[];
}


interface CartState {
  items: CartItem[];
  isOpen: boolean;
  totalItems: number;
  totalPrice: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { handle: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] };

const calculateTotals = (items: CartItem[]) => {
  let totalItems = 0;
  let bundleItemsPrice = 0;
  
  let allRegularItems: number[] = [];

  items.forEach(item => {
    totalItems += item.quantity;
    
    if (item.bundleItems) {
      bundleItemsPrice += parseFloat(item.price) * item.quantity;
    } else {
      for (let i = 0; i < item.quantity; i++) {
        allRegularItems.push(parseFloat(item.price));
      }
    }
  });

  allRegularItems.sort((a, b) => b - a);

  let dynamicPrice = 0;
  let index = 0;

  while (allRegularItems.length - index >= 5) {
    dynamicPrice += 99.99;
    index += 5;
  }

  while (allRegularItems.length - index >= 3) {
    dynamicPrice += 49.99;
    index += 3;
  }

  while (index < allRegularItems.length) {
    dynamicPrice += allRegularItems[index];
    index++;
  }

  return {
    totalItems,
    totalPrice: bundleItemsPrice + dynamicPrice
  };
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  let newItems = state.items;
  let isOpen = state.isOpen;

  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(item => item.handle === action.payload.handle);
      if (existingItem) {
        newItems = state.items.map(item =>
          item.handle === action.payload.handle
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newItems = [...state.items, { ...action.payload, quantity: 1 }];
      }
      break;
    }
    case 'REMOVE_ITEM': {
      newItems = state.items.filter(item => item.handle !== action.payload);
      break;
    }
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        newItems = state.items.filter(item => item.handle !== action.payload.handle);
      } else {
        newItems = state.items.map(item =>
          item.handle === action.payload.handle
            ? { ...item, quantity: action.payload.quantity }
            : item
        );
      }
      break;
    }
    case 'CLEAR_CART':
      newItems = [];
      break;
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN_CART':
      return { ...state, isOpen: true };
    case 'CLOSE_CART':
      return { ...state, isOpen: false };
    case 'LOAD_CART':
      newItems = action.payload;
      break;
    default:
      return state;
  }

  const { totalItems, totalPrice } = calculateTotals(newItems);

  return {
    items: newItems,
    isOpen,
    totalItems,
    totalPrice
  };
};

interface CartContextType {
  state: CartState;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  addBundle: (bundle: { size: number, price: string, items: any[] }) => void;
  removeItem: (handle: string) => void;
  removeBundleItem: (bundleHandle: string, productIndex: number) => void;

  updateQuantity: (handle: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getCheckoutUrl: () => string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const initialState: CartState = {
  items: [],
  isOpen: false,
  totalItems: 0,
  totalPrice: 0
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const { trackEcommerce } = useTracking();

  // Carregar carrinho do localStorage na inicialização
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const cartItems = JSON.parse(savedCart);
          dispatch({ type: 'LOAD_CART', payload: cartItems });
        } catch (error) {
          console.error('Erro ao carregar carrinho do localStorage:', error);
        }
      }
    }
  }, []);

  // Salvar carrinho no localStorage sempre que mudar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cart', JSON.stringify(state.items));
    }
  }, [state.items]);

  const addItem = (item: Omit<CartItem, 'quantity'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item });

    // Use centralized tracking
    trackEcommerce('add_to_cart', {
      value: parseFloat(item.price),
      currency: 'EUR',
      items: [{
        item_id: item.variant_id.toString(),
        item_name: item.title,
        price: parseFloat(item.price),
        quantity: 1
      }]
    });
  };

  const addBundle = (bundle: { size: number, price: string, items: any[] }) => {
    const bundleTitle = `${bundle.size}er Bundle: ${bundle.items.map(i => i.title).join(', ')}`;
    const bundleHandle = `bundle-${Date.now()}`;
    
    const bundleItem: CartItem = {
      handle: bundleHandle,
      variant_id: bundle.size === 3 ? 1000 : 1001,
      product_id: bundle.size === 3 ? 1000 : 1001,
      title: bundleTitle,
      price: bundle.price,
      quantity: 1,
      image: bundle.items[0]?.images[0] || "",
      bundleItems: bundle.items
    };


    dispatch({ type: 'ADD_ITEM', payload: bundleItem });
    openCart();
  };

  const removeBundleItem = (bundleHandle: string, productIndex: number) => {
    const bundle = state.items.find(i => i.handle === bundleHandle);
    if (!bundle || !bundle.bundleItems) return;

    const newBundleItems = [...bundle.bundleItems];
    newBundleItems.splice(productIndex, 1);

    if (newBundleItems.length === 0) {
      removeItem(bundleHandle);
    } else {
      // Update bundle title and items
      const newTitle = `${bundle.bundleItems.length - 1}er Bundle: ${newBundleItems.map(i => i.title).join(', ')}`;
      const updatedBundle = {
        ...bundle,
        title: newTitle,
        bundleItems: newBundleItems
      };
      
      // We need a new action to update an item or just remove and add?
      // Let's add an UPDATE_ITEM action to the reducer for efficiency
      dispatch({ type: 'REMOVE_ITEM', payload: bundleHandle });
      dispatch({ type: 'ADD_ITEM', payload: updatedBundle });
    }
  };



  const removeItem = (handle: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: handle });
  };

  const updateQuantity = (handle: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { handle, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const toggleCart = () => {
    dispatch({ type: 'TOGGLE_CART' });
  };

  const openCart = () => {
    dispatch({ type: 'OPEN_CART' });
  };

  const closeCart = () => {
    dispatch({ type: 'CLOSE_CART' });
  };

  const getCheckoutUrl = () => {
    if (state.items.length === 0) return '';

    // Use centralized tracking
    trackEcommerce('initiate_checkout', {
      value: state.totalPrice,
      currency: 'EUR',
      num_items: state.totalItems,
      items: state.items.map(item => ({
        item_id: item.variant_id.toString(),
        item_name: item.title,
        price: parseFloat(item.price),
        quantity: item.quantity
      }))
    });

    return '/checkout';
  };

  const value: CartContextType = {
    state,
    addItem,
    addBundle,
    removeItem,
    removeBundleItem,


    updateQuantity,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    getCheckoutUrl
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);

  // Durante o SSR/prerendering, retorna um contexto vazio
  if (typeof window === 'undefined' || context === undefined) {
    return {
      state: { items: [], isOpen: false, totalItems: 0, totalPrice: 0 },
      addItem: () => { },
      addBundle: () => { },
      removeItem: () => { },

      updateQuantity: () => { },
      clearCart: () => { },
      toggleCart: () => { },
      openCart: () => { },
      closeCart: () => { },
      getCheckoutUrl: () => ''
    };
  }

  return context;
};