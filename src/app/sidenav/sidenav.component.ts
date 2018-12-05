import { Component, OnInit, OnDestroy } from '@angular/core';
import { MetanavService } from '../metanav.service';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})

export class SidenavComponent implements OnInit, OnDestroy {
  public sasTypes: Array<any> = [];
  private sasTypesAll: Array<any> = [];
  private sasTypeColors: Array<any> = [];
  public filterSasTypes: Array<any> = [];
  public selectedRow: number;
  public isPageReady: boolean = false;
  
  private _filter: BehaviorSubject<string> = new BehaviorSubject<string>('');
  private _filterSub: Subscription;

  constructor(
    private _metanavService: MetanavService,
    private _router: Router
  ) { }

  async ngOnInit() {
    await this.getSasTypes();
    this._filterSub = this._filter.debounceTime(100).distinctUntilChanged().subscribe(
      async (filter) => {
        try {
          this.sasTypes = this.sasTypesAll;
          this.filterSasTypes = this.sasTypes.filter(
            (data) =>
              data.ID.toLowerCase().indexOf(filter.toLocaleLowerCase()) !== -1
          );
          this.sasTypes = this.filterSasTypes;
        } catch (error) {
          console.log(error);
        }
      });

    this.setActiveTypeRow(this._metanavService.getTypeFromUrl());
  }

  private _colorizeMe(inputString) {
    return this._metanavService.colourHash(inputString);
  }

  public async getSasTypes() {
    try {
      let data = await this._metanavService.getTypes();
      this.sasTypes = data.SASTypes;
      this.sasTypesAll = this.sasTypes;
      let mapped = this.sasTypes.map((item) => {
        return this._colorizeMe(item.ID)
      });
      this.sasTypeColors = mapped;
      this.isPageReady = true;
    } catch (error) {
      console.log(error);
    }
  }

  public goToType(sasType: string, ind: number) {
    this._router.navigateByUrl("/type/" + sasType);
    this.setActiveTypeRow(sasType);
    this.clearFilter();
  }

  public onFilterInput(filter: string) {
    this._filter.next(filter);
  }

  public clearFilter() {
    this._filter.next('');
  }

  public setActiveTypeRow(sasType: string) {
    for (let i = 0; i < this.sasTypesAll.length; i++) {
      if (this.sasTypesAll[i].ID === sasType) {
        this.selectedRow = i;
        break;
      }
    }
  }

  ngOnDestroy() {
    this._filterSub.unsubscribe();
  }
}
