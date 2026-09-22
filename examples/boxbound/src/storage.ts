import * as settings from '@nativescript/core/application-settings';
import {NativeSettingsStorage} from '../../../bridge/storage/settings-storage';
/** Keep existing save keys. apply() updates memory immediately and queues disk
 * writes; commit only at lifecycle/menu checkpoints, not on every step. */
export class MobileSettingsStorage extends NativeSettingsStorage {
  override setItem(key:string,value:string):void {settings.setString('haiyue-game:'+key,String(value));}
  override removeItem(key:string):void {settings.remove('haiyue-game:'+key);}
  override clear():void {for(const key of settings.getAllKeys())if(key.startsWith('haiyue-game:'))settings.remove(key);}
  flush():void {settings.flush();}
}
