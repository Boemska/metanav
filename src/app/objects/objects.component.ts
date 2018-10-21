import { Component, OnDestroy } from '@angular/core';
import { Router, Params, NavigationEnd } from '@angular/router';
import { MetanavService } from '../metanav.service';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-objects',
  templateUrl: './objects.component.html',
  styleUrls: ['./objects.component.scss']
})

export class ObjectsComponent implements OnDestroy {

  public url: string = "";
  public sasObjects: Array<any> = [];
  public sasObjectsAll: Array<any> = [];
  public filterSasTypes: Array<any> = [];
  public selectedRow: number;
  public sasType: string;
  public isPageReady: boolean = false;
  private _linkObjectsSub: Subscription;
  private _filterSub: Subscription;
  private _filter: BehaviorSubject<string> = new BehaviorSubject<string>('');

  constructor(
    private _metanavService: MetanavService,
    private _router: Router
  ) {

    this._linkObjectsSub = this._router.events.subscribe(
      async (link: Params) => {
        if (link instanceof NavigationEnd) {
          this.url = link.url;
          try {
            this.isPageReady = false;
            this.sasType = await this._metanavService.getLastValueFromString(this.url);
            let data = await this._metanavService.getObjects(this.sasType);
            this.sasObjectsAll = data.SASObjects;
            this.sasObjects = this.sasObjectsAll;
            this.isPageReady = true;
          } catch (error) {
            console.log(error);
          }
        }
      });

    this._filterSub = this._filter.debounceTime(100).distinctUntilChanged().subscribe(
      async (filter) => {
        try {
          this.sasObjects = this.sasObjectsAll;
          this.filterSasTypes = this.sasObjects.filter(
            (data) =>
              data.NAME.toLowerCase().indexOf(filter.toLocaleLowerCase()) !== -1
          );
          this.sasObjects = this.filterSasTypes;
        } catch (error) {
          console.log(error);
        }
      });
  }

  public async goToObject(sasObject: string, ind: number) {
    this.selectedRow = ind;
    this._router.navigateByUrl(this.url + "/object/" + sasObject);
  }

  public onFilterInput(filter: string) {
    this._filter.next(filter);
  }

  public clearFilter() {
    this._filter.next('');
  }

  ngOnDestroy() {
    this._linkObjectsSub.unsubscribe();
    this._filterSub.unsubscribe();
  }
}
