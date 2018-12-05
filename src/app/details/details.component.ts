import { Component, OnDestroy, AfterViewInit } from '@angular/core';
import { MetanavService } from '../metanav.service';
import { Subscription } from 'rxjs/Subscription';
import * as d3 from 'd3';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements AfterViewInit, OnDestroy {

  // tables
  public detailArray: Array<any> = [];
  public dataFromUrl: Array<string> = [];
  public url: string = '';
  public isPageReady: boolean = true;
  public expand: boolean = false;
  public sasObjectUri: string;
  public historyArray: Array<any> = [];
  public historyObj: any = {};
  public detailsName: string;
  public nextAssoc: string;
  public collAssoc: Array<any> = [];
  public viewType: string = 'tb1_ch0';
  public tableParent: any = {};
  public fontHeaderColor: string;
  public fontAscColor: string;
  public sidenavToggleMessage: string;
  private _firstStart: boolean = true;
  private _sidenavToggle: Subscription;

  // d3js
  public dataset: any = { nodes: [], edges: [] };
  public svg: any;
  public nodes: any;
  public edges: any;
  public nodelabels: any;
  public force: any;
  public backToExistingNode: boolean = false;
  public parentNode: any;
  private _indexInNodesArray: number;
  private _indexOfClickedAssoc: number;
  private _numberOfAssoc: number; // number of elements in association table
  private _sourceNode: number; // index of node that is sourceNode in subtree
  private _subAssocParent: number;
  private _nodeCollection: Array<any> = [];
  private readonly _objectType: string = 'object';
  private readonly _subAssocType: string = 'subAssoc';
  private readonly _collAssocType: string = 'collAssoc';
  private readonly _stateNew: string = 'new';
  private readonly _stateOld: string = 'old';

  constructor(
    private _metanavService: MetanavService
  ) {
    this._sidenavToggle = this._metanavService.getSidenavToggleState().subscribe(
      message => {
        this.sidenavToggleMessage = message;
        this.reDrawGraph();
      });
  }

  public async ngAfterViewInit() {
    if (this._firstStart) {
      this.url = window.location.href.split('#').pop();
      await this._loadData();
      this.drawGraph();
      this._firstStart = false;
    }
  }

  public async onUrlChanged() {
    this.url = window.location.href.split('#').pop();
    await this._loadData();
    this.disposeGraph();
    this.drawGraph();
  }

  public reDrawGraph() {
    setTimeout(() => {
      this.onResize();
    }, 0);
  }

  public onResize(event?) {
    this.disposeGraph();
    this.drawGraph();
  }

  public removeHistoryAfter(i: number) {
    this.historyArray.splice(i + 1, this.historyArray.length - i - 1);
    this.detailArray.splice(i + 1, this.detailArray.length - i - 1);
  }

  public updateProperties(assoc: string, ind?: number, numb?: number, parentNode?: any) {
    this._indexOfClickedAssoc = ind;
    this._numberOfAssoc = numb;
    this.nextAssoc = assoc;
    this.parentNode = parentNode;
  }

  public async goToDetails(assocUri: string) {
    for (let j = 0; j < this.historyArray.length; j++) {
      this.historyArray[j].EXPANDED = false;
    }
    this.onUrlChanged();
  }

  public disposeGraph() {
    if (this.force) {
      this.force.stop();
    }
    document.getElementById('chart').innerHTML = '';
  }

  public setViewType(viewType: string) {
    this.viewType = viewType;
  }

  public disableClick(assocID: string) {
    this.findParentInChart(assocID).clickable = false;
  }

  public findParentInChart(assocID: string): any {
    return this.dataset.nodes
      .filter(el => el.nodeType === 'collAssoc')
      .filter(e => e.assocArry.groupAssoc
        .filter(el => el.genID === assocID).length > 0)
      .shift();
  }

  private _getValueByName(data: any): string {
    return data
      .filter(e => "Name" === e.NAME)
      .map(e => e.VALUE)
      .shift();
  }

  private _moveToOld(arr: Array<any>) {
    for (let el in arr) {
      if (arr.hasOwnProperty(el)) {
        arr[el].state = this._stateOld;
      }
    }
  }

  private _disableClick(d3Item: any) {
    d3Item.clickable = false;
  }

  private pushCollapsedAssociations(assocArr: any, parentNode: any, nodeIndex: number) {

    // small circles - associations
    this.parentNode = parentNode;
    if (!this._subAssocParent) {
      this._subAssocParent = this.dataset.nodes.length;
    }

    for (let i = 0; i < assocArr.groupAssoc.length; i++) {
      const e = assocArr.groupAssoc[i];
      let subAssociation = {
        name: e.NAME,
        assocName: assocArr.name,
        nodeType: this._subAssocType,
        state: this._stateNew,
        nodeURI: e.ASSOCURI,
        indexAssoc: i,
        clickable: true,
        numbOfAssoc: assocArr.groupAssoc.length,
        color: this._colorizeMe(e.NAME),
        parentNode: this.dataset.nodes[nodeIndex],
        genID: assocArr.genID
      };

      this.dataset.nodes.push(subAssociation);

      // connect association to parent CollAssoc
      this.dataset.edges.push({
        source: this.dataset.nodes[nodeIndex],
        target: subAssociation
      });
    }
  }

  private _collapseAssociations(inputArray: Array<any>): any {
    let countsAcc = inputArray.reduce((acc, el) => {
      let key = el.ASSOC;
      if (!acc.hasOwnProperty(key)) {
        acc[key] = [];
      }
      acc[key].push(el);
      return acc;
    }, {});

    let collapsedAssoc = Object.keys(countsAcc).map(el => {
      return {
        name: el,
        groupAssoc: countsAcc[el],
        genID: Math.random()
      };
    });
    return collapsedAssoc;
  }

  private _getNodeIndexById(nodeId: string): number {
    let returnObject = this._nodeCollection
      .filter(e => nodeId === e.id)
      .shift();
    return returnObject !== undefined ? returnObject.index : -1;
  }

  private _reactivateNode(historyNode: any) {
    historyNode.state = this._stateNew;
    this.dataset.edges
      .filter(e => e.source === historyNode)
      .forEach(e => e.target.state = this._stateNew);
  }

  private _connectToExistingNode(sourceNode: any, targetNode: any) {
    this.dataset.edges.push({
      source: sourceNode,
      target: targetNode
    });
  }

  private _pushToEdgeArray(edgeSource: any, edgeTarget: any) {
    if (edgeSource !== edgeTarget) {
      this.dataset.edges.push({
        source: edgeSource,
        target: edgeTarget
      });
    }
  }

  private _colorizeMe(inputString) {
    return this._metanavService.colourHash(inputString);
  }

  private _bwColor(hex: string): string {
    if (hex.indexOf('#') === 0) {
      hex = hex.slice(1);
    }

    let r = parseInt(hex.slice(0, 2), 16);
    let g = parseInt(hex.slice(2, 4), 16);
    let b = parseInt(hex.slice(4, 6), 16);

    return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#FFFFFF';
  }

  private _lastInHistArr() {
    return this.historyArray[this.historyArray.length - 1];
  }

  private _removeSubAssociaction(index: number) {
    this.dataset.edges = this.dataset.edges.filter(e => !(e.source === this.dataset.nodes[index] || e.target === this.dataset.nodes[index]));
    this.dataset.nodes.splice(index, 1);
  }

  public chartClick(d: any, nodeType: any) {
    if (nodeType === this._subAssocType) {
      this._removeSubAssociaction(d.index);
      this.updateProperties(d.assocName, d.numbOfAssoc, d.indexAssoc, d.parentNode);

      let searchResult = this._getNodeIndexById(this._metanavService.getLastValueFromString(d.nodeURI));
      if (searchResult > -1) {
        this._connectToExistingNode(d.parentNode, this.dataset.nodes[searchResult]);
        this._moveToOld(this.dataset.nodes);
        this._reactivateNode(this.dataset.nodes[searchResult]);
        this.backToExistingNode = true;
      }
      this.goToDetails(d.nodeURI);
    } else if (nodeType === this._collAssocType) {
      this.disposeGraph();
      this.pushCollapsedAssociations(d.assocArry, d.parentNode, d.index);
      this._disableClick(d);
      this.drawGraph();
    }
  }

  public drawGraph() {

    let chartDiv = document.getElementById('chart');
    let nodes = this.dataset.nodes;
    let edges = this.dataset.edges;
    let nodesDistance = 100;
    let w = chartDiv.clientWidth;
    let h = chartDiv.clientHeight;

    this.svg = d3
      .select(chartDiv)
      .append('svg')
      .attr('width', w)
      .attr('height', h);

    // set edges
    this.edges = this.svg
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('marker-end', 'url(#arrowhead)')
      .style('stroke', '#ccc')
      .style('pointer-events', 'none');

    // set node type
    this.nodes = this.svg
      .selectAll('circle' || 'rect')
      .data(nodes)
      .enter()
      .append('svg')
      .attr({
        'class': d => d.state === this._stateNew ? this._stateNew : this._stateOld
      })
      .append('g')
      .attr({
        'class': d => d.nodeType === this._objectType ?
          this._objectType : d.nodeType === this._collAssocType ?
            this._collAssocType : this._subAssocType,
      });

    // set node labels as new or old
    this.nodelabels = this.svg
      .selectAll('nodelabelNew' || 'nodelabelOld')
      .data(nodes)
      .enter()
      .append('text')
      .attr('dy', d => { return d.nodeType === 'object' ? 40 : 30; })
      .style("text-anchor", "end")
      .text(d => d.name)
      .attr('class', d => d.state === this._stateNew ? 'nodelabelNew' : 'nodelabelOld');

    // set opacity for old nodes
    this.svg
      .selectAll('.' + this._stateOld)
      .transition()
      .style("opacity", 1); // 1 - no opacity

    // Objects (Big circle)
    this.svg
      .selectAll('.' + this._objectType)
      .append('circle')
      .attr('class', 'circle')
      .attr('r', 24)
      .style('fill', d => d.color);

    // Collapsed Associations (RECT)
    this.svg
      .selectAll('.' + this._collAssocType)
      .append('rect')
      .attr('height', 24)
      .attr('width', 24)
      .attr('x', d => -12)
      .attr('y', d => -12)
      .attr('class', 'rect')
      .style('fill', d => d.color)
      .on('click', d => {
        if (d.clickable) {
          this.chartClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    // Sub Association (small circle)
    this.svg
      .selectAll('.' + this._subAssocType)
      .append('circle')
      .attr('class', 'circle')
      .attr('r', 10)
      .style('fill', d => d.color)
      .on('click', d => {
        if (d.clickable) {
          this.chartClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    // new labels
    this.svg
      .selectAll('.nodelabelNew')
      .attr('stroke', '#676767')
      .text(d => d.name)
      .on('click', d => {
        if (d.clickable) {
          this.chartClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    // old labels
    this.svg
      .selectAll('.nodelabelOld')
      .attr('stroke', 'lightgray')
      .text(d => d.name)
      .on('click', d => {
        if (d.clickable) {
          this.chartClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    // arrow
    this.svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('refX', 60)
      .attr('refY', 0)
      .attr('viewBox', '-0 -5 10 10')
      .attr('orient', 'auto')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('xoverflow', 'visible')
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#ccc')
      .attr('stroke', '#ccc');

    this.force = d3.layout
      .force()
      .size([w, h])
      .nodes(nodes)
      .links(edges)
      .linkDistance(nodesDistance)
      .charge(-1000)
      .start();

    this.force
      .on('tick', () => {
        this.edges
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        this.nodes
          .attr('cx', d => d.x)
          .attr('cy', d => d.y)
          .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
        this.nodelabels
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      });
    this.nodes.call(this.force.drag);
  }

  private _addToNodes(assocListIndex?: number) {
    if (assocListIndex === undefined) {
      this._indexInNodesArray = 0;
      this._sourceNode = 0;
    } else {
      this._indexInNodesArray = this.dataset.nodes.length;
      this._sourceNode = this.parentNode !== undefined ? this.parentNode.index : this._indexInNodesArray - this._numberOfAssoc + assocListIndex;
      this._moveToOld(this.dataset.nodes);
      this._subAssocParent = null;
    }

    // newNode
    this.dataset.nodes.push({
      name: this._lastInHistArr().NAME,
      nodeType: this._objectType,
      state: this._stateNew,
      color: this._colorizeMe(this._lastInHistArr().TYPE),
      parentNode: this.dataset.nodes[this._sourceNode] || null,
      genID: this._lastInHistArr().genID
    });

    // nodeCollection
    this._nodeCollection.push({
      id: this._metanavService.getLastValueFromString(this._lastInHistArr().OBJECT),
      index: this.dataset.nodes.length - 1
    });

    // connect created object to parent association
    this._pushToEdgeArray(
      this.dataset.nodes[this._sourceNode],
      this.dataset.nodes[this._indexInNodesArray]
    );

    // create Collapsed Associations Nodes
    for (let i = 0; i < this.collAssoc.length; i++) {
      let nodeName = this.collAssoc[i].name;

      this.dataset.nodes.push({
        name: nodeName,
        nodeType: this._collAssocType,
        state: this._stateNew,
        indexAssoc: i,
        assocArry: this.collAssoc[i],
        clickable: true,
        numbOfAssoc: this.collAssoc.length,
        color: this._colorizeMe(nodeName),
        parentNode: this.dataset.nodes[this._indexInNodesArray],
        genID: this.collAssoc[i].genID
      });

      // connect association to parent object
      this._pushToEdgeArray(
        this.dataset.nodes[this._indexInNodesArray],
        this.dataset.nodes[this.dataset.nodes.length - 1]);
    }
  }

  private async _loadData() {
    try {
      this.sasObjectUri = await this._metanavService.getLastValueFromString(this.url);
      this.dataFromUrl[0] = this._metanavService.getTypeFromUrl();

      let data = await this._metanavService.getDetails(this.sasObjectUri);

      data.Associations.forEach(el => {
        el.genID = Math.random();
      });

      this.detailArray.push({
        ASSOC: data.Associations,
        ATTRPROP: data.attrprop
      });

      this.collAssoc = this._collapseAssociations(data.Associations);
      this.detailsName = this._getValueByName(this.detailArray[this.detailArray.length - 1].ATTRPROP);

      this.historyObj = {
        TYPE: this.dataFromUrl[0],
        OBJECT: this.sasObjectUri,
        NAME: this.detailsName,
        ASC: this.nextAssoc,
        URL: this.url,
        COLOR: this._colorizeMe(this.dataFromUrl[0]),
        ASCCLR: this._colorizeMe(this.nextAssoc),
        genID: Math.random(),
        EXPANDED: true
      };
      this.historyArray.push(this.historyObj);

      setTimeout(() => {
        let mainDiv = document.getElementById('divMain');
        let elmnt = mainDiv.childNodes[mainDiv.childNodes.length - 2].firstChild.parentElement;
        elmnt.scrollIntoView();
      }, 0);

      this.fontHeaderColor = this._bwColor(this._lastInHistArr().COLOR);
      this.fontAscColor = this._bwColor(this._lastInHistArr().ASCCLR);

      if (!this.backToExistingNode) {
        this._addToNodes(this._indexOfClickedAssoc);
      } else {
        this.backToExistingNode = false;
      }
    } catch (error) {
      console.log(error);
    }
  }

  public ngOnDestroy() {
    this._sidenavToggle.unsubscribe();
  }
}
