import { createContext, useContext } from "react";
import { DEFAULT_RATE, type Currency } from "../../lib/money";

/** The currency amounts are shown (and typed) in, and the fixed naira-per-dollar rate. Provided by App. */
export type MoneyCtx = { currency: Currency; rate: number };
export const MoneyContext = createContext<MoneyCtx>({ currency: "NGN", rate: DEFAULT_RATE });
export const useMoney = () => useContext(MoneyContext);
