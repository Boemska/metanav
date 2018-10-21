import { Component, OnInit, OnDestroy } from '@angular/core';
import { MetanavService } from '../metanav.service';
import { Subscription } from 'rxjs';
import { Router, Params, NavigationEnd } from '@angular/router';
import * as d3 from 'd3';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements OnInit, OnDestroy {

  // tables
  public detailArray: Array<any> = [{ ASSOC: '', ATTRPROP: '' }];
  public dataFromUrl: Array<string> = [];
  public url: string = '';
  public isPageReady: boolean = true;
  public sasObjectUri: string;
  public historyArray: Array<any> = [];
  public historyObj: any = {};
  public detailsName: string;
  public nextAssoc: string;
  public collAssoc: Array<any> = [];
  public viewType: string = 'tb1_gr0';
  private _firstStart: boolean = true;
  private _linkDetailsSub: Subscription;

  // d3js
  public dataset: any = { nodes: [], edges: [] };
  public svgContainer: any;
  public nodes: any;
  public edges: any;
  public nodelabels: any;
  public force: any;
  public backToExistingNode: boolean = false;
  public graphHeight: number;
  public graphWidth: number;
  private _indexInNodesArray: number;
  private _indexOfClickedAssoc: number;
  private _numberOfAssoc: number; // number of elements in association table
  private _sourceNode: number; // index of node that is sourceNode in subtree
  private _subAssocParent: number;
  private _parentNode: any;
  private _nodeCollection: Array<any> = [];
  private readonly _objectType: string = 'object';
  private readonly _subAssocType: string = 'subAssoc';
  private readonly _collAssocType: string = 'collAssoc';
  private readonly _stateNew: string = 'new';
  private readonly _stateOld: string = 'old';

  constructor(
    private _metanavService: MetanavService,
    private _router: Router
  ) { }

  public async ngOnInit() {
    if (this._firstStart) {
      this.url = window.location.href.split('#').pop();
      await this._loadData();
      this.drawGraph();
      this._firstStart = false;
    }
    this._linkDetailsSub = this._router.events.subscribe(
      async (link: Params) => {
        if (link instanceof NavigationEnd) {
          this.url = link.url;
          await this._loadData();
          this.drawGraph();
        }
      });
  }

  public removeHistoryAfter(i: number) {
    this.historyArray.splice(i + 1, this.historyArray.length - i - 1);
    this.detailArray.splice(i + 1, this.detailArray.length - i - 1);
  }

  public updateAssociation(assoc: string, ind?: number, numb?: number, parentNode?: any) {
    this._indexOfClickedAssoc = ind;
    this._numberOfAssoc = numb;
    this.nextAssoc = assoc;
    this._parentNode = parentNode;
  }

  public async goToDetails(assocUri: string) {
    let objUri = assocUri.split('\\');
    let sasType = objUri[0].split(':');
    for (let j = 0; j < this.historyArray.length; j++) {
      this.historyArray[j].EXPANDED = false;
    }
    this._router.navigateByUrl('/type/' + sasType[1] + '/object/' + objUri[1]);
  }

  public disposeGraph() {
    if (this.force) {
      this.force.stop();
    }
    document.getElementById('graphic').innerHTML = '';
  }

  public setViewType(viewType: string) {
    this.viewType = viewType;
  }

  public setGraphSize() {

    let width = window.innerWidth;
    let height = window.innerHeight;
    if (this.viewType === 'tb0_gr0') {
      this.graphWidth = (width - 300) * 0.5;
    } else {
      this.graphWidth = width - 300;
    }
    this.graphHeight = height - 200;
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


  private _pushCollapsedAssociations(assocArr: any, parentNode: any, nodeIndex: number) {

    this._parentNode = parentNode;
    if (!this._subAssocParent) {
      this._subAssocParent = this.dataset.nodes.length;
    }

    let indSource = nodeIndex;

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
        parentNode: this.dataset.nodes[indSource]
      };

      this.dataset.nodes.push(subAssociation);

      // connect association to parent CollAssoc
      this.dataset.edges.push({
        source: this.dataset.nodes[indSource],
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
        groupAssoc: countsAcc[el]
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
    this.dataset.edges.push({
      source: edgeSource,
      target: edgeTarget
    });
  }

  private _removeSubAssociaction(index: number) {
    this.dataset.edges = this.dataset.edges.filter(e => !(e.source === this.dataset.nodes[index] || e.target === this.dataset.nodes[index]));
    this.dataset.nodes.splice(index, 1);
  }

  private _graphClick(d: any, nodeType: any) {
    if (nodeType === this._subAssocType) {
      this.disposeGraph();
      this._removeSubAssociaction(d.index);
      this.updateAssociation(d.assocName, d.numbOfAssoc, d.indexAssoc, d.parentNode);

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
      this._pushCollapsedAssociations(d.assocArry, d.parentNode, d.index);
      this._disableClick(d);
      this.drawGraph();
    }
  }

  private _addToNodes(assocListIndex?: number) {
    if (assocListIndex === undefined) {
      this._indexInNodesArray = 0;
      this._sourceNode = 0;
    } else {
      this._indexInNodesArray = this.dataset.nodes.length;
      this._sourceNode = this._parentNode !== undefined ? this._parentNode.index : this._indexInNodesArray - this._numberOfAssoc + assocListIndex;
      this._moveToOld(this.dataset.nodes);
      this._subAssocParent = null;
    }

    // newNode
    this.dataset.nodes.push({
      name: this.historyArray[this.historyArray.length - 1].NAME,
      nodeType: this._objectType,
      state: this._stateNew,
      parentNode: this.dataset.nodes[this._sourceNode]
    });

    // nodeCollection
    this._nodeCollection.push({
      id: this._metanavService.getLastValueFromString(this.historyArray[this.historyArray.length - 1].OBJECT),
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
        parentNode: this.dataset.nodes[this._indexInNodesArray]
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

      if (this.detailArray[0].ASSOC === '' && this.detailArray[0].ATTRPROP === '') {
        this.detailArray[0].ASSOC = data.Associations;
        this.detailArray[0].ATTRPROP = data.attrprop;
      } else {
        this.detailArray.push({
          ASSOC: data.Associations,
          ATTRPROP: data.attrprop
        });
      }

      this.collAssoc = this._collapseAssociations(data.Associations);
      this.detailsName = this._getValueByName(this.detailArray[this.detailArray.length - 1].ATTRPROP);

      this.historyObj = {
        TYPE: this.dataFromUrl[0],
        OBJECT: this.sasObjectUri,
        NAME: this.detailsName,
        ASC: this.nextAssoc,
        URL: this.url,
        EXPANDED: true
      };
      this.historyArray.push(this.historyObj);

      if (!this.backToExistingNode) {
        this._addToNodes(this._indexOfClickedAssoc);
      } else {
        this.backToExistingNode = false;
      }
    } catch (error) {
      console.log(error);
    }
  }

  public async drawGraph() {

    await this.setGraphSize();

    let w = this.graphWidth;
    let h = this.graphHeight;

    let nodesDistance = 100;
    let colors = d3.scale.category10();
    let nodes = this.dataset.nodes;
    let edges = this.dataset.edges;

    this.svgContainer = d3
      .select('#graphic')
      .append('svg')
      .attr('width', w)
      .attr('height', h);

    this.force = d3.layout.force()
      .size([w, h])
      .nodes(nodes)
      .links(edges)
      .linkDistance(nodesDistance)
      .charge(-1000)
      .start();

    this.nodes = this.svgContainer
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

    this.edges = this.svgContainer.selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('marker-end', 'url(#arrowhead)')
      .style('stroke', '#ccc')
      .style('pointer-events', 'none');

    this.nodelabels = this.svgContainer
      .selectAll('nodelabelNew' || 'nodelabelOld')
      .data(nodes)
      .enter()
      .append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('class', d => d.state === this._stateNew ? 'nodelabelNew' : 'nodelabelOld')
      .text(d => d.name);

    this.svgContainer
      .selectAll('.' + this._stateOld)
      .transition()
      .style("opacity", 0.15);

    // Objects (Big circle)
    this.svgContainer
      .selectAll('.' + this._objectType)
      .append('circle')
      .attr('class', 'circle')
      .attr('r', 25)
      .style('fill', (d, i) => colors(i));

    // Collapsed Associations (RECT)
    this.svgContainer
      .selectAll('.' + this._collAssocType)
      .append('rect')
      .attr('height', 25)
      .attr('width', 25)
      .attr('class', 'rect')
      .style('fill', (d, i) => colors(i))
      .on('click', d => {
        if (d.clickable) {
          this._graphClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    // Sub Association (small circle)
    this.svgContainer
      .selectAll('.' + this._subAssocType)
      .append('circle')
      .attr('class', 'circle')
      .attr('r', 10)
      .style('fill', (d, i) => colors(i))
      .on('click', d => {
        if (d.clickable) {
          this._graphClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    this.svgContainer
      .selectAll('.nodelabelNew')
      .attr('stroke', 'black')
      .text(d => d.name)
      .on('click', d => {
        if (d.clickable) {
          this._graphClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    this.svgContainer
      .selectAll('.nodelabelOld')
      .attr('stroke', 'lightgray')
      .text(d => d.name)
      .on('click', d => {
        if (d.clickable) {
          this._graphClick(d, d.nodeType);
        }
      })
      .style('cursor', 'pointer');

    this.svgContainer
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('refX', 25)
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

    this.force.on('tick', () => {
      this.nodes
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
      this.edges
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      this.nodelabels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
    this.nodes.call(this.force.drag);
  }

  public ngOnDestroy() {
    this._linkDetailsSub.unsubscribe();
  }

}
