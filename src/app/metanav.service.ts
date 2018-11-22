import { Injectable } from '@angular/core';
import { AdapterService } from './boemska/adapter.service';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs/Subject';
import * as ColorHash from 'color-hash';

@Injectable()
export class MetanavService {

  private sidenavToggleSubject = new Subject<any>();

  public setSidenavToggleState(message: string) {
    this.sidenavToggleSubject.next({ text: message });
  }

  public getSidenavToggleState(): Observable<any> {
    return this.sidenavToggleSubject.asObservable();
  }

  constructor(
    private _adapterService: AdapterService
  ) { }

  public async getTypes() {
    try {
      return await this._adapterService.call('User/getTypes', null);

    } catch (err) {
      // TODO: handle error
      console.log(err);
    }
  }

  public async getObjects(sendType: string) {

    let data = this._adapterService.createData([
      {
        "type": sendType
      }
    ], 'SendType');

    try {
      return await this._adapterService.call('User/getObjects', data);

    } catch (err) {
      // TODO: handle error
      console.log(err);
    }
  }

  public async getDetails(sendUri: string) {

    let data = this._adapterService.createData([
      {
        "uri": sendUri
      },
    ], 'SendURI');

    try {
      return await this._adapterService.call('User/getDetails', data);
    } catch (err) {
      // TODO: handle error
      console.log(err);
    }
  }

  public getLastValueFromString(str: string): string {
    if (str) {
      let data: Array<string> = str.split("/");
      if (data.length <= 1) {
        data = str.split("\\");
      }
      return data[data.length - 1];
    }
  }

  public splitUrl(url: string): Array<string> {
    if (url) {
      let data: Array<string> = url.split("/");
      return data;
    }
  }

  public getTypeFromUrl(): string {
    let currentUrl = window.location.hash;
    let arr: Array<string> = currentUrl.split("/");
    return arr[2];
  }

  public colourHash(inputString: string): string {
    let clHash = new ColorHash();
    return clHash.hex(inputString);
  }

}
