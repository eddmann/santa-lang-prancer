export type Obj = {
  inspect(): string;
  isTruthy(): boolean;
  getName(): string;
};

export type ValueObj = Obj & {
  hashCode(): number;
  equals(that: Obj): boolean;
};
