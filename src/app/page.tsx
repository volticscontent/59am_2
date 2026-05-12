"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import CategoryCarousel from "../components/CategoryCarousel";
import FilterSidebar from "../components/FilterSidebar";
import PerfumeInfo from "../components/PerfumeInfo";
import Newsletter from "../components/Newsletter";
import Footer from "../components/Footer";
import Image from "next/image";
import Link from "next/link";
import {
  getProductData,
  getProductByHandle,
  filterProducts,
  searchProducts,
  formatPrice,
  getDiscountedPrice,
  FilterState,
  ProductsData,
  Product,
} from "../utils/products";
import { useBundle } from "@/contexts/BundleContext";
import { useCart } from "@/contexts/CartContext";
import { useUTM } from "@/contexts/UTMContext";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const [productData, setProductData] = useState<ProductsData | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  // Local pre-selection state — does NOT touch the cart until user confirms on product page
  const [pendingSelections, setPendingSelections] = useState<string[]>([]);
  const router = useRouter();

  const {
    isBundleActive,
    bundleSize,
    selectedItems,
    currentSlot,
    setCurrentSlot,
    setReturnToHandle,
    selectProduct,
    removeProduct,
    removeProductByHandle,
    clearBundle,
  } = useBundle();
  
  const {
    state: cartState,
    addItem,
    removeItem,
    openCart
  } = useCart();

  const { trackEcommerce } = useUTM();

  // Sync cart displayed total
  const [displayedTotal, setDisplayedTotal] = useState(0);
  useEffect(() => {
    setDisplayedTotal(cartState.totalItems);
  }, [cartState.totalItems]);

  // Floating icon for cart additions (bundle mode or normal cart)
  const [isStackVisible, setIsStackVisible] = useState(false);
  const [lastStackUpdate, setLastStackUpdate] = useState(0);

  const addFloatingIcon = (productHandle: string) => {
    const isNewItem = !cartState.items.some(item => item.handle === productHandle);
    if (isNewItem && cartState.totalItems > 0) {
      setIsStackVisible(true);
      setLastStackUpdate(Date.now());
      const timer = setTimeout(() => {
        setIsStackVisible(false);
        setDisplayedTotal(cartState.totalItems + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setTimeout(() => {
        setDisplayedTotal(cartState.totalItems + 1);
      }, 50);
    }
  };

  const searchParams = useSearchParams();

  // Sincronizar slot e returnTo da query string
  useEffect(() => {
    const slot = searchParams.get("bundleSlot");
    const returnTo = searchParams.get("returnTo");
    const bundleActive = searchParams.get("bundleActive");

    // Se navegou para a Home sem intenção de bundle, limpa o estado
    if (slot === null && bundleActive === null && isBundleActive) {
      // Pequeno delay para evitar conflito com redirecionamentos imediatos
      const timer = setTimeout(() => {
        clearBundle();
      }, 100);
      return () => clearTimeout(timer);
    }

    if (slot !== null) {
      setCurrentSlot(parseInt(slot));
    }
    if (returnTo !== null) {
      setReturnToHandle(returnTo);
    }
  }, [
    searchParams,
    isBundleActive,
    clearBundle,
    setCurrentSlot,
    setReturnToHandle,
  ]);

  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    brands: [],
    gender: [],
    priceRange: null,
    promotion: false,
  });

  const applyFiltersAndSearch = useCallback(
    (currentFilters: FilterState, query: string) => {
      if (productData) {
        let products = productData.products;

        // Aplicar pesquisa primeiro se houver query
        if (query.trim()) {
          products = searchProducts(products, query);
        }

        // Depois aplicar filtros
        const filtered = filterProducts(products, currentFilters);
        setFilteredProducts(filtered);
      }
    },
    [productData],
  );

  // Load product data once on mount
  useEffect(() => {
    const data = getProductData();
    setProductData(data);
  }, []);

  // Apply filters whenever filters, searchQuery, or productData change
  useEffect(() => {
    applyFiltersAndSearch(filters, searchQuery);
  }, [productData, filters, searchQuery, applyFiltersAndSearch]);

  // Redirect to product page when 3 items are pre-selected (non-bundle flow)
  // We do NOT add to cart here — the user clicks "IN DEN WARENKORB" on the product page
  useEffect(() => {
    if (pendingSelections.length === 3 && !isBundleActive) {
      // Save selections to sessionStorage so product page can restore them
      sessionStorage.setItem('pendingBundle', JSON.stringify(pendingSelections));
      router.push(`/products/${pendingSelections[0]}?bundleComplete=true`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelections.length]);

  // Auto-open cart disabled per user request
  /*
  useEffect(() => {
    if (cartState.totalItems === 5 && !cartState.isOpen) {
      openCart();
    }
  }, [cartState.totalItems, cartState.isOpen, openCart]);
  */

  // Note: Bundle synchronization with cart is handled on the product page
  // The home page now uses pendingSelections for initial flow, so we don't clear the bundle here
  // based on the cart state, which is intentionally empty during the pre-selection phase.

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    applyFiltersAndSearch(newFilters, searchQuery);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFiltersAndSearch(filters, query);
  };

  const currentTotal = isBundleActive 
    ? selectedItems.filter(i => i !== null).length 
    : (cartState.totalItems + pendingSelections.length);

  const totalProducts = productData ? productData.products.length : 0;
  const filteredCount = filteredProducts.length;

  return (
    <div className="min-h-screen bg-white">
      <Header
        onSearch={handleSearch}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Top Alert Banner */}
      {(cartState.totalItems > 0 || pendingSelections.length > 0 || isBundleActive) && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md">
          <div className="bg-white border border-gray-100 shadow-2xl rounded-xl p-4 flex items-start gap-3 animate-slide-down" key={currentTotal}>
            <div className="mt-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className="flex-1">
              {currentTotal < 3 ? (
                <>
                  <p className="text-sm font-bold text-gray-900">Mix & match — 3 perfumes por £49.99</p>
                  <p className="text-xs text-gray-500">{3 - currentTotal} perfumes missing. Unlock the discount.</p>
                </>
              ) : currentTotal === 3 ? (
                <>
                  <p className="text-sm font-bold text-gray-900 text-green-600">🎉 Discount Unlocked!</p>
                  <p className="text-xs text-gray-500">Congratulations, you&apos;ve unlocked the discount 3 perfumes for 49.99. Select more 2 perfumes to unlock the maximum discount.</p>
                </>
              ) : currentTotal === 4 ? (
                <>
                  <p className="text-sm font-bold text-gray-900">Continue adicionando!</p>
                  <p className="text-xs text-gray-500">1 more perfume to unlock the maximum discount.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-900 text-green-600">🎉 Maximum Discount Achieved!</p>
                  <p className="text-xs text-gray-500">Congratulations, you&apos;ve unlocked the maximum discount!</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="">
        <Image
          src="/bannersHeader/Banner_1.jpg"
          alt="Promotional banner for perfumes and fragrances"
          width={1200}
          height={400}
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto sm:px-6 lg:px-8 pt-6">
        {/* Product Overview Headline */}
        <div className="product-overview__headline-container mb-6 pl-4 ">
          <div className="product-overview__headline-wrapper flex items-center gap-1 text-[1.2rem]">
            <div className="sr-only" role="heading" aria-level={1}>
              Parfüm & Düfte {totalProducts}
              <div className="sr-only-translation">ergebnisse</div>
            </div>
            <h1
              aria-hidden="true"
              data-testid="product-overview-headline"
              className="font-ultra-thin text-black uppercase"
            >
              Parfüm & Düfte
            </h1>
            <span aria-hidden="true" className="font-thin text-gray-600">
              {filteredCount < totalProducts
                ? `(${filteredCount.toLocaleString("de-DE")} von ${totalProducts.toLocaleString("de-DE")})`
                : `(${totalProducts.toLocaleString("de-DE")})`}
            </span>
          </div>
        </div>

        {/* Category Carousel with Config Button */}
        <div className="mb-8 pl-4">
          <div className="flex items-center gap-1.5 mb-8">
            <button
              aria-haspopup="true"
              type="button"
              className="flex-shrink-0 flex items-center justify-center p-[0.6rem] border border-black hover:bg-gray-50 transition-colors"
              data-testid="menu-button-facets"
              aria-label="Filtros"
              onClick={() => setIsFilterSidebarOpen(true)}
            >
              <svg
                width="25"
                height="25"
                viewBox="0 0 25 25"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                role="img"
              >
                <path
                  d="M18.95 7H21.5C21.7761 7 22 6.77614 22 6.5C22 6.22386 21.7761 6 21.5 6H18.95C18.7184 4.85888 17.7095 4 16.5 4C15.2905 4 14.2816 4.85888 14.05 6H2.5C2.22386 6 2 6.22386 2 6.5C2 6.77614 2.22386 7 2.5 7H14.05C14.2816 8.14112 15.2905 9 16.5 9C17.7095 9 18.7184 8.14112 18.95 7ZM16.5 8C15.6716 8 15 7.32843 15 6.5C15 5.67157 15.6716 5 16.5 5C17.3284 5 18 5.67157 18 6.5C18 7.32843 17.3284 8 16.5 8Z"
                  fill="black"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
                <path
                  d="M9.94999 12H21.5C21.7761 12 22 11.7761 22 11.5C22 11.2239 21.7761 11 21.5 11H9.94999C9.71836 9.85888 8.70948 9 7.5 9C6.29052 9 5.28164 9.85888 5.05001 11H2.5C2.22386 11 2 11.2239 2 11.5C2 11.7761 2.22386 12 2.5 12H5.05001C5.28164 13.1411 6.29052 14 7.5 14C8.70948 14 9.71836 13.1411 9.94999 12ZM7.5 13C6.67157 13 6 12.3284 6 11.5C6 10.6716 6.67157 10 7.5 10C8.32843 10 9 10.6716 9 11.5C9 12.3284 8.32843 13 7.5 13Z"
                  fill="black"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
                <path
                  d="M21.5 17H16.95C16.7184 18.1411 15.7095 19 14.5 19C13.2905 19 12.2816 18.1411 12.05 17H2.5C2.22386 17 2 16.7761 2 16.5C2 16.2239 2.22386 16 2.5 16H12.05C12.2816 14.8589 13.2905 14 14.5 14C15.7095 14 16.7184 14.8589 16.95 16H21.5C21.7761 16 22 16.2239 22 16.5C22 16.7761 21.7761 17 21.5 17ZM13 16.5C13 17.3284 13.6716 18 14.5 18C15.3284 18 16 17.3284 16 16.5C16 15.6716 15.3284 15 14.5 15C13.6716 15 13 15.6716 13 16.5Z"
                  fill="black"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <CategoryCarousel onFiltersChange={handleFiltersChange} />
            </div>
          </div>
        </div>

        {/* Filter Sidebar */}
        <FilterSidebar
          isOpen={isFilterSidebarOpen}
          onClose={() => setIsFilterSidebarOpen(false)}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Products Grid */}
        <div className="mt-12 mb-8">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-[1.2px] md:gap-6">
              {filteredProducts.map((product) => {
                const handleProductClick = (e: React.MouseEvent) => {
                  if (isBundleActive) {
                    e.preventDefault();
                    selectProduct(product);
                  }
                };

                const handleSelectClick = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Pre-select for bundle (max 3, no duplicates) — does NOT add to cart
                  if (pendingSelections.includes(product.handle)) return;
                  if (pendingSelections.length >= 3) return;
                  setPendingSelections(prev => [...prev, product.handle]);
                };

                const handleDeselectClick = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingSelections(prev => prev.filter(h => h !== product.handle));
                };

                const isSelected = pendingSelections.includes(product.handle);
                const selectionIndex = pendingSelections.indexOf(product.handle);

                return (
                  <div
                    key={product.id}
                    className="group"
                  >
                    <div className="overflow-hidden hover:shadow-lg transition-shadow duration-300 relative bg-white pb-4 h-full flex flex-col">
                      {/* Product Image */}
                      <Link href={isBundleActive ? "#" : `/products/${product.handle}`} onClick={handleProductClick} className="block aspect-square w-[100%] relative overflow-hidden">
                        <div className="absolute inset-0 bg-[#f5f5f5]"></div>
                        {product.images && product.images.length > 0 ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-full h-[100%] bg-[#f5f5f5] rounded-lg">
                              <Image
                                src={product.images[0]}
                                alt={product.title}
                                fill
                                sizes="(max-width: 768px) 50vw, 33vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-300 rounded-lg"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-[120%] flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg">
                              <div className="text-center p-4">
                                <div className="w-16 h-16 mx-auto mb-2 bg-gray-300 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-8 h-8 text-gray-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                                <p className="text-xs text-gray-800 font-medium">
                                  {product.primary_brand}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bundle Select Overlay */}
                        {isBundleActive && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm uppercase">
                              Auswählen
                            </button>
                          </div>
                        )}

                        {/* Promotion Badge */}
                        {product.promotion && (
                          <div className="absolute top-3 left-3 bg-[#1f1f1f] text-white text-[10px] font-thin py-[0.2rem] px-[0.6rem]">
                            {product.promotion.description}
                          </div>
                        )}
                      </Link>

                      {/* Product Info */}
                      <div className="py-2 px-4 cursor-pointer" onClick={(e) => {
                        if (!isBundleActive) {
                          window.location.href = `/products/${product.handle}`;
                        } else {
                          handleProductClick(e);
                        }
                      }}>
                        {/* Brand */}
                        <p className="text-[14px] text-spacing-[0.01rem] font-spacing-tight font-thin text-gray-700 uppercase tracking-wide my-2">
                          {product.primary_brand}
                        </p>

                        {/* Title */}
                        <h3 className="font-thin text-[0.8rem] text-gray-800 line-clamp-3 group-hover:text-blue-600 transition-colors mt-[1px]">
                          {product.title}
                        </h3>

                        {/* Category */}
                        <p className="font-thin text-xs text-gray-400 mb-16 mt-[2px]">
                          {product.category.name}
                        </p>

                        {/* Price */}
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col items-baseline gap-2">
                            {product.price > 0 ? (
                              <>
                                <span className="text-lg font-thin font-[4px] text-gray-900">
                                  {formatPrice(getDiscountedPrice(product), "EUR")}
                                </span>
                                {getDiscountedPrice(product) !== product.price && (
                                  <span className="text-xs font-thin text-gray-400 line-through">
                                    {formatPrice(product.price, "EUR")}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm font-medium text-green-600">
                                Sonderangebot
                              </span>
                            )}
                          </div>

                          {/* Gender indicator */}
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {product.category.gender === "unisex"
                              ? "Unisex"
                              : product.category.gender === "men"
                                ? "Herren"
                                : "Damen"}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400 my-2">
                          100 ml |{" "}
                          <span className="text-xs text-gray-400 my-2">
                            24 €
                          </span>
                        </p>
                      </div>

                      {/* Action Buttons */}
                      {!isBundleActive && (
                        <div className="flex flex-col gap-2 px-4 mt-auto">
                          <div className="flex gap-2">
                            <button
                              onClick={handleSelectClick}
                              disabled={pendingSelections.length >= 3 && !isSelected}
                              className={`flex-1 text-[11px] font-bold py-3 px-2 rounded-none transition-colors uppercase ${
                                pendingSelections.length >= 3 && !isSelected
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-black text-white hover:bg-gray-800'
                              }`}
                            >
                              SELECT
                            </button>
                            {(isSelected || cartState.items.some(item => item.handle === product.handle)) && (
                              <button
                                onClick={(e) => {
                                  if (isSelected) {
                                    handleDeselectClick(e);
                                  } else {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeItem(product.handle);
                                  }
                                }}
                                className="flex-1 bg-[#e1e1e1] text-black text-[11px] font-bold py-3 px-2 rounded-none hover:bg-gray-300 transition-colors uppercase"
                              >
                                REMOVE
                              </button>
                            )}
                          </div>
                          {cartState.totalItems > 0 || pendingSelections.length > 0 ? (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Move any pending selections to the cart
                                if (pendingSelections.length > 0) {
                                  const pendingProds = pendingSelections
                                    .map(h => getProductByHandle(h))
                                    .filter((p): p is Product => p !== null && p !== undefined);

                                  pendingProds.forEach(prod => {
                                    addItem({
                                      handle: prod.handle,
                                      variant_id: Number(prod.id),
                                      product_id: Number(prod.id),
                                      title: prod.title,
                                      price: getDiscountedPrice(prod).toString(),
                                      image: prod.images[0] || ""
                                    });
                                  });

                                  const totalValue = pendingProds.reduce(
                                    (sum, p) => sum + getDiscountedPrice(p), 0
                                  );
                                  trackEcommerce('add_to_cart', {
                                    currency: 'EUR',
                                    value: totalValue,
                                    items: pendingProds.map(p => ({
                                      item_id: p.id,
                                      item_name: p.title,
                                      price: getDiscountedPrice(p),
                                      quantity: 1,
                                    })),
                                  });

                                  setPendingSelections([]);
                                }
                                
                                openCart();
                              }}
                              className="w-full bg-white text-black text-[11px] font-bold py-3 px-4 rounded-none border border-black hover:bg-gray-50 transition-colors uppercase text-center mt-1"
                            >
                              FINISH ORDER
                            </button>
                          ) : (
                            <Link
                              href={`/products/${product.handle}`}
                              className="w-full bg-white text-black text-[11px] font-bold py-3 px-4 rounded-none border border-black hover:bg-gray-50 transition-colors uppercase text-center mt-1"
                            >
                              VIEW PROMOTION
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Keine Produkte gefunden
              </h3>
              <p className="text-gray-500">
                Versuchen Sie, Ihre Filter zu ändern oder zu entfernen.
              </p>
            </div>
          )}
        </div>

        {/* Bundle Floating Indicator */}
        {isBundleActive && (
          <div className="fixed bottom-4 inset-x-4 md:left-auto md:inset-x-auto md:right-6 z-50 md:w-[320px] bg-white border border-gray-200 shadow-2xl rounded-2xl p-3 md:p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <div className="flex flex-col">
                <span className="text-[10px] md:text-xs font-bold uppercase text-gray-400">
                  Bundle konfigurieren
                </span>
                <span className="text-xs md:text-sm font-bold text-gray-900">
                  {selectedItems.filter((i) => i !== null).length} von{" "}
                  {bundleSize} Düften ausgewählt
                </span>
              </div>
              <button
                onClick={() => {
                  selectedItems.forEach(item => {
                    if (item) removeItem(item.handle);
                  });
                  clearBundle();
                }}
                className="text-[10px] md:text-xs text-gray-500 underline"
              >
                Abbrechen
              </button>
            </div>
            <div className="flex gap-1.5 md:gap-2">
              {selectedItems.map((item, i) => {
                const firstEmpty = selectedItems.findIndex(
                  (item) => item === null,
                );
                const activeSlotIndex =
                  firstEmpty !== -1 ? firstEmpty : currentSlot;

                return (
                  <div
                    key={i}
                    className={`relative flex-1 aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden ${
                      activeSlotIndex === i
                        ? "border-black bg-gray-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    {item && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item) removeItem(item.handle);
                          removeProduct(i);
                        }}
                        className="absolute top-0 left-0 z-10 bg-red-500 shadow-md rounded-full p-0.5 hover:bg-red-600 transition-colors border border-red-700 text-white"
                        title="Entfernen"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-white"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {item ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={item.images[0]}
                          alt={item.title}
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] md:text-xs text-gray-300 font-bold">
                        {i + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Seções de conteúdo */}
      <PerfumeInfo />
      <Newsletter />

      {/* Floating Icon Stack */}
      {/* Hidden when selecting bundle items to avoid UI clutter */}
      {!(isBundleActive || pendingSelections.length > 0) && cartState.totalItems > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 items-end">
          {/* Base Icon (Always visible if items > 0) */}
          <button 
            key="base-icon"
            onClick={openCart}
            className="w-14 h-14 bg-white border border-gray-200 shadow-xl rounded-2xl flex items-center justify-center relative hover:scale-110 transition-transform cursor-pointer"
          >
            <div className="w-10 h-10 relative overflow-hidden rounded-lg">
              {cartState.items[0]?.image && (
                <Image
                  src={cartState.items[0].image}
                  alt="Base Cart"
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <span className="absolute -top-2 -left-2 w-6 h-6 bg-black text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-md">
              {displayedTotal}
            </span>
          </button>

          {/* Floating Stack (Only items from index 1 onwards, visible for 0.8s) */}
        {isStackVisible && cartState.items.slice(1).map((item, index) => {
          return (
            <div 
              key={`${item.handle}-${lastStackUpdate}`}
              className="w-14 h-14 bg-white border border-gray-200 shadow-xl rounded-2xl flex items-center justify-center relative animate-stack-flow"
              style={{ 
                animationDelay: `${(cartState.items.length - 2 - index) * 0.05}s`
              }}
            >
              <div className="w-10 h-10 relative overflow-hidden rounded-lg">
                {item.image && (
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-contain"
                  />
                )}
              </div>
              <span className="absolute -top-2 -left-2 w-6 h-6 bg-black text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-md">
                {index + 2}
              </span>
            </div>
          );
        })}
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}
