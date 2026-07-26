export const DIVISIONS = ["Div-A", "Div-B", "Div-C", "Div-D"] as const;
export type Division = (typeof DIVISIONS)[number];
