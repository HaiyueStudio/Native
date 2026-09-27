declare class HYNonConsumableStore extends NSObject {
  static alloc(): HYNonConsumableStore;
  initWithProductIDOnChange(productID: string, onChange: () => void): this;
  callCompletion(action: string, completion: (json: string) => void): void;
  dispose(): void;
}
declare namespace org.haiyue.purchases {
  class HYPlayBilling {
    constructor(context: android.content.Context, productID: string, listener: HYPlayBilling.Listener);
    call(action: string, activity: android.app.Activity | null, completion: HYPlayBilling.Completion): void;
    dispose(): void;
    static verifyLease(lease: string, publicKey: string, productID: string, packageName: string, installationID: string, now: number): string;
    static tokenHash(token: string): string;
  }
  namespace HYPlayBilling {
    class Listener { constructor(implementation: { changed(): void }); }
    class Completion { constructor(implementation: { complete(json: string): void }); }
  }
}
