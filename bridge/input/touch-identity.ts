/** Native wrappers may differ between callbacks; compare the underlying touch identity. */
export class TouchIdentity<T> {
  private next = 1;
  private readonly entries: { touch: T; id: number }[] = [];
  constructor(private readonly equal: (a: T, b: T) => boolean) {}
  find(touch: T): number | undefined { return this.entries.find(entry => this.equal(entry.touch, touch))?.id; }
  begin(touch: T): number {
    const found = this.find(touch);
    if (found !== undefined) return found;
    const id = this.next++;
    this.entries.push({ touch, id });
    return id;
  }
  end(id: number): void {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index >= 0) this.entries.splice(index, 1);
  }
  clear(): void { this.entries.length = 0; }
  get count(): number { return this.entries.length; }
}
