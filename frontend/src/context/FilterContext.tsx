import { createContext, useContext, useState, type ReactNode } from "react";

export interface BatchOption {
  id: string;
  label: string;
}

export const BATCHES: BatchOption[] = [
  { id: "2023-2027", label: "2023\u20132027" },
  { id: "2024-2028", label: "2024\u20132028" },
  { id: "2025-2029", label: "2025\u20132029" },
];

export const DIVISIONS = ["Div-A", "Div-B", "Div-C", "Div-D"] as const;

interface FilterContextType {
  selectedBatch: string;
  setSelectedBatch: (batch: string) => void;
  selectedDivision: string;
  setSelectedDivision: (division: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedBatch, setSelectedBatch] = useState<string>(BATCHES[0].id);
  const [selectedDivision, setSelectedDivision] = useState<string>(""); // "" means All Divisions

  return (
    <FilterContext.Provider
      value={{
        selectedBatch,
        setSelectedBatch,
        selectedDivision,
        setSelectedDivision,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
