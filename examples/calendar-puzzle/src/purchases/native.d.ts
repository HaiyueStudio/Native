declare class HYCalendarStore extends NSObject {
  static alloc(): HYCalendarStore;
  initWithProductIDOnChange(productID: string, onChange: () => void): this;
  callCompletion(action: string, completion: (json: string) => void): void;
  dispose(): void;
}
declare namespace org.haiyue.calendarstore {
  class HYCalendarBilling {
    constructor(context: android.content.Context, productID: string, listener: HYCalendarBilling.Listener);
    call(action: string, activity: android.app.Activity | null, completion: HYCalendarBilling.Completion): void;
    dispose(): void;
    static verifyLease(lease: string, publicKey: string, productID: string, packageName: string, installationID: string, now: number): string;
    static tokenHash(token: string): string;
  }
  namespace HYCalendarBilling {
    class Listener { constructor(implementation: { changed(): void }); }
    class Completion { constructor(implementation: { complete(json: string): void }); }
  }
}
