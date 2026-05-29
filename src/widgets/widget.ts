export interface Widget<TConfig = any> {
  readonly element: HTMLElement;
  update(config: TConfig): void;
  destroy?(): void;
}
