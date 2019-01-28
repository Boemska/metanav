import { Component, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
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
  public displayAlert: boolean = false;
  public alertRemovingTimer: any;
  public activeTabButton: Element;

  // d3js
  public dataset: any = { nodes: [], edges: [] };
  public simulation: any;
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
  public nodeGroup: any;
  public linkGroup: any;
  public textGroup: any;
  public textGroupTitles: any;
  public nodeElements: any;
  public linkElements: any;
  public textElements: any;
  public textElementsTitles: any;
  public d3StoppingTimer: any;
  public linkForce: d3.ForceLink<{}, d3.SimulationLinkDatum<{}>>;
  public dragDrop: d3.DragBehavior<Element, {}, {} | d3.SubjectPosition>;
  public clickedSubAssoc: any;
  public clickedSubAssocY: any;
  public clickedSubAssocX: any;
  public subAssocNumber: any;
  private readonly offsetForOpening = 30;

  constructor(
    private _metanavService: MetanavService,
    private _router: Router
  ) {
    this._sidenavToggle = this._metanavService.getSidenavToggleState().subscribe(
      message => {
        this.sidenavToggleMessage = message;
        this.updateGraph();
      });
  }

  public async ngAfterViewInit() {
    if (this._firstStart) {
      this.initializeGraph();
      this.onUrlChanged();
      this._firstStart = false;
    }
  }

  public async onUrlChanged() {
    this.url = window.location.href.split('#').pop();
    await this._loadData();
    this.updateGraph();
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
    let objUri = assocUri.split('\\');
    let sasType = objUri[0].split(':');
    for (let j = 0; j < this.historyArray.length; j++) {
      this.historyArray[j].EXPANDED = false;
    }
    await this._router.navigateByUrl('/type/' + sasType[1] + '/object/' + objUri[1]);
    this.onUrlChanged();
  }

  public setViewType(viewType: string) {
    this.viewType = viewType;
    if (this.activeTabButton) {
      let ariaSelected = this.activeTabButton.attributes[4];
      if (ariaSelected.value === 'true') {
        this.activeTabButton.className = 'btn btn-link nav-link nav-item active';
      }
    }
  }

  public activateTableViewTab() {
    this.activeTabButton = document.getElementsByClassName('btn btn-link nav-link nav-item active')[0];
    this.activeTabButton.className = 'btn btn-link nav-link nav-item';

    let tableViewTabButton = document.getElementById('firstTab');
    tableViewTabButton.className = 'btn btn-link nav-link nav-item active';
  }

  public deactivateTableViewTab() {
    let tableViewTabButton = document.getElementById('firstTab');
    tableViewTabButton.className = 'btn btn-link nav-link nav-item';
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

  private _getTypeURL(url: string): string {
    return url.split("/object/")[0];
  }

  private _disableClick(d3Item: any) {
    d3Item.clickable = false;
  }

  private pushCollapsedAssociations(dataObject) {
    let assocArry = dataObject.assocArry;
    let nodeIndex = dataObject.index;

    // small circles - associations
    this.parentNode = dataObject.parentNode;
    if (!this._subAssocParent) {
      this._subAssocParent = this.dataset.nodes.length;
    }

    let assocCount;
    if (assocArry.groupAssoc.length > 15) {
      assocCount = 15;
    } else {
      assocCount = assocArry.groupAssoc.length;
    }

    for (let i = 0; i < assocCount; i++) {

      const e = assocArry.groupAssoc[i];
      let newX = 0;
      let newY = 0;
      let diffX = this.parentNode.x - dataObject.x;
      let diffY = this.parentNode.y - dataObject.y;
      newX = this.calculateStartingXPosition(diffX, diffY, dataObject.x);
      newY = this.calculateStartingYPosition(diffX, diffY, dataObject.y);

      let subAssociation = {
        name: e.NAME,
        assocName: assocArry.name,
        nodeType: this._subAssocType,
        state: this._stateNew,
        nodeURI: e.ASSOCURI,
        indexAssoc: i,
        clickable: true,
        numbOfAssoc: assocArry.groupAssoc.length,
        color: this._colorizeMe(e.NAME),
        parentNode: this.dataset.nodes[nodeIndex],
        genID: assocArry.genID,
        d3Id: Math.random().toString(),
        x: newX,
        y: newY
      };

      this.dataset.nodes.push(subAssociation);

      // connect association to parent CollAssoc
      this.dataset.edges.push({
        source: this.dataset.nodes[nodeIndex],
        target: subAssociation
      });
    }
  }

  private calculateStartingXPosition(diffX: number, diffY: number, x: any) {
    let newX: number;
    if (diffX > 0 && diffY > 0) {
      newX = x - this.offsetForOpening;
    } else if (diffX < 0 && diffY > 0) {
      newX = x + this.offsetForOpening;
    } else if (diffX > 0 && diffY < 0) {
      newX = x - this.offsetForOpening;
    } else {
      newX = x + this.offsetForOpening;
    }
    return newX;
  }

  private calculateStartingYPosition(diffX: number, diffY: number, y: any) {
    let newY: number;
    if (diffX > 0 && diffY > 0) {
      newY = y - this.offsetForOpening;
    } else if (diffX < 0 && diffY > 0) {
      newY = y - this.offsetForOpening;
    } else if (diffX > 0 && diffY < 0) {
      newY = y + this.offsetForOpening;
    } else {
      newY = y + this.offsetForOpening;
    }
    return newY;
  }

  private _createGroupedAssociations(inputArray: Array<any>): any {
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
        genID: Math.random().toString()
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

  private _createLinkForNodes(sourceNode: any, targetNode: any) {
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
      this.clickedSubAssoc = d;
      this.clickedSubAssocX = d.x;
      this.clickedSubAssocY = d.y;
      this._removeSubAssociaction(d.index);
      this.updateProperties(d.assocName, d.numbOfAssoc, d.indexAssoc, d.parentNode);

      let searchResult = this._getNodeIndexById(this._metanavService.getLastValueFromString(d.nodeURI));
      if (searchResult > -1) {
        this._createLinkForNodes(d.parentNode, this.dataset.nodes[searchResult]);
        this._moveToOld(this.dataset.nodes);
        this._reactivateNode(this.dataset.nodes[searchResult]);
        this.backToExistingNode = true;
      }
      this.goToDetails(d.nodeURI);
      this._disableClick(d);
    } else if (nodeType === this._collAssocType) {
      this.pushCollapsedAssociations(d);
      this.subAssocNumber = d.assocArry.groupAssoc.length;
      this._disableClick(d);
      this.updateGraph();
      if (d.assocArry.groupAssoc.length > 15) {
        this.displayAlert = true;
      }

      if (this.alertRemovingTimer) {
        clearTimeout(this.alertRemovingTimer);
      }
      this.alertRemovingTimer = setTimeout(() => {
        this.displayAlert = false;
      }, 5000);
    }
  }

  public initializeGraph() {

    let w = window.innerWidth / 1.9;
    let h = window.innerHeight / 1.5;

    let zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', () =>
        svg.attr('transform', d3.event.transform));

    let svg = d3.select('svg#chart')
      .attr('viewBox', '0 0 ' + w + ' ' + h)
      .call(zoom)
      .append('g');

    this.linkGroup = svg.append('g').attr('class', 'links');
    this.nodeGroup = svg.append('g').attr('class', 'nodes');
    this.textGroup = svg.append('g').attr('class', 'innerLabels');
    this.textGroupTitles = svg.append('g').attr('class', 'labels');

    let linkForce = d3
      .forceLink()
      .id((link: any) => link.id)
      .strength(0.4)
      .distance(70);

    this.simulation = d3.forceSimulation()
      .force("link", linkForce)
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .velocityDecay(0.25)
      .alphaMin(0.009)
      .alphaDecay(0.08);

    this.dragDrop = d3.drag()
      .on('start', (node: any) => {
        node.fx = node.x;
        node.fy = node.y;
      })
      .on('drag', (node: any) => {
        this.simulation.alphaTarget(0.9).restart();
        node.fx = d3.event.x;
        node.fy = d3.event.y;
      })
      .on('end', (node: any) => {
        if (!d3.event.active) {
          this.simulation.alphaTarget(0);
        }
        node.fx = null;
        node.fy = null;
      });
    this.updateGraph();
  }

  public updateGraph() {

    this.linkGroup
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('refX', 40)
      .attr('refY', 0)
      .attr('viewBox', '-0 -5 10 10')
      .attr('orient', 'auto')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('xoverflow', 'visible')
      .append('path')
      .attr('d', 'M 0,-3 L 10,0 L 0,3')
      .attr('fill', '#ccc')
      .attr('stroke', '#ccc');

    this.linkElements = this.linkGroup.selectAll('line')
      .data(this.dataset.edges, link => link.target.d3Id + link.source.d3Id);
    this.linkElements.exit().remove();

    let linkEnter = this.linkElements
      .enter()
      .append('line')
      .attr('marker-end', 'url(#arrowhead)')
      .style('stroke', '#ccc')
      .style('pointer-events', 'none');

    this.linkElements = linkEnter.merge(this.linkElements);

    let symbolGenerator = d3.symbol()
      .type(d => {
        if (d.nodeType === 'object') {
          return d3.symbolCircle;
        } else if (d.nodeType === 'collAssoc') {
          return d3.symbolSquare;
        } else if (d.nodeType === 'subAssoc') {
          return d3.symbolCircle;
        }
      })
      .size(d => {
        if (d.nodeType === 'object') {
          return 1500;
        } else if (d.nodeType === 'collAssoc') {
          return 600;
        } else if (d.nodeType === 'subAssoc') {
          return 300;
        }
      });
    let pathData = symbolGenerator;

    this.nodeElements = this.nodeGroup.selectAll('path')
      .data(this.dataset.nodes, node => { return node.d3Id; });

    let nodeEnter = this.nodeElements
      .enter()
      .append('path')
      .attr('d', pathData)
      .style('fill', d => d.color)
      .style('cursor', 'pointer')
      .on('click', d => {
        if (d.clickable) {
          this.chartClick(d, d.nodeType);
        }
      })
      .call(this.dragDrop);

    this.nodeElements.exit().remove();

    this.nodeElements = nodeEnter.merge(this.nodeElements);

    this.textElements = this.textGroup.selectAll('text')
      .data(this.dataset.nodes, node => { return node.d3Id; });

    let textEnter = this.textElements
      .enter()
      .append('text')
      .text(d => {
        if (d.nodeType === 'object') {
          return d.type;
        } else if
        (d.nodeType === 'collAssoc') {
          return d.name.substring(0, 2);
        }
      })
      .attr('dy', d => d.nodeType === 'object' ? 7 : 4)
      .attr('font-size', d => d.nodeType === 'object' ? 20 : 12)
      .attr('fill', 'white')
      .style("text-anchor", "middle")
      .attr('cursor', 'pointer')
      .on('click', d => {
        if (d.clickable) {
          this.chartClick(d, d.nodeType);
        }
      })
      .call(this.dragDrop);

    this.textElements.exit().remove();

    this.textElements = textEnter.merge(this.textElements);

    this.textElementsTitles = this.textGroupTitles.selectAll('svg')
      .data(this.dataset.nodes, node => { return node.d3Id; });

    let textEnterTitles = this.textElementsTitles
      .enter()
      .append('svg');

    textEnterTitles
      .append('text')
      .attr('class', 'labelsOld')
      .text(d => d.nodeType === 'object' ? d.name.toLowerCase() : d.name)
      .attr('dy', d => d.nodeType === 'object' ? 38 : d.nodeType === 'collAssoc' ? 26 : 22)
      .attr('fill', d => d.nodeType === 'object' ? '#676767' : '#565656')
      .attr('font-size', d => d.nodeType === 'object' ? 18 : 13)
      .attr('letter-spacing', d => d.nodeType === 'object' ? -2 : -.3)
      .attr('font-weight', d => d.nodeType === 'object' ? 'bolder' : 400)
      .style('cursor', d => d.nodeType === 'object' ? 'default' : 'pointer')
      .on('click', d => {
        if (d.clickable) {
          this.chartClick(d, d.nodeType);
        }
      });

    textEnterTitles
      .append('text')
      .attr('class', 'labelsOld')
      .text(d => d.objectId)
      .attr('dy', 52)
      .attr('dx', 5)
      .attr('fill', '#676767')
      .attr('font-size', 11)
      .attr('font-weight', 'lighter')
      .style('cursor', 'default');

    this.textElementsTitles.exit().remove();

    this.textElementsTitles = textEnterTitles.merge(this.textElementsTitles);

    d3.selectAll('.labelsOld')
      .each(function (d) {
        let text = d3.select(this);
        text.attr('stroke', (d1: any) => {
          if (d1.state === 'old') { return 'lightgray'; }
        });
        text.attr('stroke-width', (d1: any) => {
          if (d1.state === 'old') { return 0.8; }
        });
      });

    this.simulation.nodes(this.dataset.nodes).on('tick', () => {

      this.linkElements
        .attr('x1', link => { return link.source.x; })
        .attr('y1', link => { return link.source.y; })
        .attr('x2', link => { return link.target.x; })
        .attr('y2', link => { return link.target.y; });

      this.nodeElements
        .attr('transform', function (d) { return 'translate(' + d.x + ' ' + d.y + ')'; });

      this.textElements
        .attr('x', node => { return node.x; })
        .attr('y', node => { return node.y; });

      this.textElementsTitles
        .attr('x', node => { return node.x; })
        .attr('y', node => { return node.y; });
    });

    this.simulation.force('link').links(this.dataset.edges);
    this.simulation
      .alphaTarget(0.9)
      .restart();

    if (this.d3StoppingTimer) {
      clearTimeout(this.d3StoppingTimer);
    }

    this.d3StoppingTimer = setTimeout(() => {
      this.simulation.alphaTarget(0);
    }, 500);
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

    let parentNode = this.dataset.nodes[this._sourceNode] || null;
    let newX = 0;
    let newY = 0;

    if (parentNode && parentNode.x && parentNode.y) {
      let diffX = parentNode.x - this.clickedSubAssocX;
      let diffY = parentNode.y - this.clickedSubAssocY;

      newX = this.calculateStartingXPosition(diffX, diffY, this.clickedSubAssocX);
      newY = this.calculateStartingYPosition(diffX, diffY, this.clickedSubAssocY);
    }

    // newNode
    this.dataset.nodes.push({
      name: this._lastInHistArr().NAME,
      nodeType: this._objectType,
      state: this._stateNew,
      color: this._colorizeMe(this._lastInHistArr().TYPE),
      parentNode: this.dataset.nodes[this._sourceNode] || null,
      genID: this._lastInHistArr().genID,
      d3Id: Math.random().toString(),
      objectId: this._lastInHistArr().OBJECT,
      type: this.historyObj.TYPE.charAt(0),
      x: this.clickedSubAssocX,
      y: this.clickedSubAssocY
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
        genID: this.collAssoc[i].genID,
        d3Id: Math.random().toString(),
        x: newX,
        y: newY
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
        el.genID = Math.random().toString();
      });

      this.detailArray.push({
        ASSOC: data.Associations,
        ATTRPROP: data.attrprop
      });

      this.collAssoc = this._createGroupedAssociations(data.Associations);
      this.detailsName = this._getValueByName(this.detailArray[this.detailArray.length - 1].ATTRPROP);

      this.historyObj = {
        TYPE: this.dataFromUrl[0],
        OBJECT: this.sasObjectUri,
        NAME: this.detailsName,
        ASC: this.nextAssoc,
        URL: this.url,
        typeURL: this._getTypeURL(this.url),
        COLOR: this._colorizeMe(this.dataFromUrl[0]),
        ASCCLR: this._colorizeMe(this.nextAssoc),
        genID: Math.random().toString(),
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
