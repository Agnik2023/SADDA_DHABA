import React from "react";
import type { Category } from "../../types";

interface CategoryBarProps {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
}) => {
  return (
    <div className="sticky top-[89px] z-30 border-b border-stone-200/80 bg-stone-50/95 px-4 py-2.5 shadow-xs backdrop-blur-md">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto scroll-smooth">
        <button
          onClick={() => onSelectCategory("all")}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold shadow-xs transition ${
            activeCategoryId === "all"
              ? "bg-stone-900 text-white shadow-stone-900/20"
              : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
          }`}
        >
          <span>✨</span>
          <span>All items</span>
        </button>

        {categories.map((category) => {
          const isActive = activeCategoryId === category.id;
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold shadow-xs transition ${
                isActive
                  ? "bg-orange-600 text-white shadow-orange-600/20"
                  : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
              }`}
            >
              <span>{category.icon || "🍽️"}</span>
              <span>{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
