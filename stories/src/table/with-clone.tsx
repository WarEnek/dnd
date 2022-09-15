/* eslint-disable react/sort-comp */
import type { Property } from 'csstype';
import React, { Component, Fragment, ReactElement } from 'react';
import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors } from '@atlaskit/theme';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type {
  DropResult,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
} from '@hello-pangea/dnd';
import { invariant } from '../../../src/invariant';

import reorder from '../reorder';
import { grid } from '../constants';
import type { Quote } from '../types';

const Table = styled.table<{ layout: Property.TableLayout }>`
  width: 500px;
  margin: 0 auto;
  table-layout: ${(props) => props.layout};
`;

const TBody = styled.tbody`
  border: 0;
`;

const THead = styled.thead`
  border: 0;
  border-bottom: none;
  background-color: ${colors.N20};
`;

const Row = styled.tr<{ isDragging?: boolean }>`
  ${(props) => (props.isDragging ? `background: ${colors.G50};` : '')};
`;

const Cell = styled.td`
  box-sizing: border-box;
  padding: ${grid}px;
`;

interface TableCellProps {
  children: ReactNode;
  isDragOccurring: boolean;
  isDragging: boolean;
  cellId: string;
}

interface TableCellSnapshot {
  width: number;
  height: number;
}

interface SnapshotMap {
  [cellId: string]: TableCellSnapshot;
}

const snapshotMap: SnapshotMap = {};

class TableCell extends React.Component<TableCellProps> {
  ref: HTMLElement | undefined | null;

  componentDidMount() {
    const cellId: string = this.props.cellId;
    if (!snapshotMap[cellId]) {
      return;
    }

    if (!this.props.isDragging) {
      // cleanup the map if it is not being used
      delete snapshotMap[cellId];
      return;
    }

    this.applySnapshot(snapshotMap[cellId]);
  }

  getSnapshotBeforeUpdate(
    prevProps: TableCellProps,
  ): TableCellSnapshot | undefined | null {
    // we will be locking the dimensions of the dragging item on mount
    if (this.props.isDragging) {
      return null;
    }

    const isDragStarting: boolean =
      this.props.isDragOccurring && !prevProps.isDragOccurring;

    if (!isDragStarting) {
      return null;
    }

    return this.getSnapshot();
  }

  componentDidUpdate(
    prevProps: TableCellProps,
    prevState: unknown,
    snapshot?: TableCellSnapshot | null,
  ) {
    const ref: HTMLElement | undefined | null = this.ref;
    if (!ref) {
      return;
    }

    if (snapshot) {
      this.applySnapshot(snapshot);
      return;
    }

    if (this.props.isDragOccurring) {
      return;
    }

    // inline styles not applied
    if (ref.style.width == null) {
      return;
    }

    // no snapshot and drag is finished - clear the inline styles
    ref.style.removeProperty('height');
    ref.style.removeProperty('width');
  }

  componentWillUnmount() {
    const snapshot: TableCellSnapshot | undefined | null = this.getSnapshot();
    if (!snapshot) {
      return;
    }
    snapshotMap[this.props.cellId] = snapshot;
  }

  getSnapshot = (): TableCellSnapshot | undefined | null => {
    if (!this.ref) {
      return null;
    }

    const { width, height } = this.ref.getBoundingClientRect();

    const snapshot: TableCellSnapshot = {
      width,
      height,
    };

    return snapshot;
  };

  applySnapshot = (snapshot: TableCellSnapshot) => {
    const ref: HTMLElement | undefined | null = this.ref;

    if (!ref) {
      return;
    }

    ref.style.width = `${snapshot.width}px`;
    ref.style.height = `${snapshot.height}px`;
  };

  setRef = (ref?: HTMLElement | null) => {
    this.ref = ref;
  };

  render() {
    return <Cell ref={this.setRef}>{this.props.children}</Cell>;
  }
}

interface TableRowProps {
  quote: Quote;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}

// Using a table as the portal so that we do not get react
// warnings when mounting a tr element
const table: HTMLElement = document.createElement('table');
table.classList.add('my-super-cool-table-portal');
Object.assign(table.style, {
  margin: '0',
  padding: '0',
  border: '0',
  height: '0',
  width: '0',
});
const tbody: HTMLElement = document.createElement('tbody');
table.appendChild(tbody);

invariant(document.body, 'document.body required for example');

document.body.appendChild(table);

const IsDraggingContext = React.createContext<boolean>(false);

class TableRow extends Component<TableRowProps> {
  render() {
    const { snapshot, quote, provided } = this.props;
    const child: ReactNode = (
      <IsDraggingContext.Consumer>
        {(isDragging: boolean) => (
          <Row
            ref={provided.innerRef}
            isDragging={snapshot.isDragging}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
          >
            <TableCell
              isDragOccurring={isDragging}
              isDragging={snapshot.isDragging}
              cellId="name"
            >
              {quote.author.name}
            </TableCell>
            <TableCell
              isDragOccurring={isDragging}
              isDragging={snapshot.isDragging}
              cellId="content"
            >
              {quote.content}
            </TableCell>
          </Row>
        )}
      </IsDraggingContext.Consumer>
    );

    return child;
  }
}

// TODO: make this look nicer!
const Header = styled.header`
  display: flex;
  flex-direction: column;
  width: 500px;
  margin: 0 auto;
  margin-bottom: ${grid * 2}px;
`;

/* stylelint-disable block-no-empty */
const LayoutControl = styled.div``;

const CopyTableButton = styled.button``;

/* stylelint-enable */

interface AppProps {
  initial: Quote[];
}

interface AppState {
  quotes: Quote[];
  layout: 'fixed' | 'auto';
  isDragging: boolean;
}

export default class TableApp extends Component<AppProps, AppState> {
  tableRef: HTMLElement | undefined | null;

  state: AppState = {
    quotes: this.props.initial,
    layout: 'auto',
    isDragging: false,
  };

  onBeforeDragStart = (): void => {
    this.setState({
      isDragging: true,
    });
  };

  onDragEnd = (result: DropResult): void => {
    this.setState({
      isDragging: false,
    });

    // dropped outside the list
    if (
      !result.destination ||
      result.destination.index === result.source.index
    ) {
      return;
    }

    // no movement
    if (result.destination.index === result.source.index) {
      return;
    }

    const quotes = reorder(
      this.state.quotes,
      result.source.index,
      result.destination.index,
    );

    this.setState({
      quotes,
    });
  };

  toggleTableLayout = (): void => {
    this.setState({
      layout: this.state.layout === 'auto' ? 'fixed' : 'auto',
    });
  };

  copyTableToClipboard = (): void => {
    const tableRef: HTMLElement | undefined | null = this.tableRef;
    if (tableRef == null) {
      return;
    }

    const range: Range = document.createRange();
    range.selectNode(tableRef);
    window?.getSelection()?.addRange(range);

    const wasCopied: boolean = (() => {
      try {
        const result: boolean = document.execCommand('copy');
        return result;
      } catch (e) {
        return false;
      }
    })();

    // eslint-disable-next-line no-console
    console.log('was copied?', wasCopied);

    // clear selection
    window?.getSelection()?.removeAllRanges();
  };

  render(): ReactElement {
    return (
      <IsDraggingContext.Provider value={this.state.isDragging}>
        <DragDropContext
          onBeforeDragStart={this.onBeforeDragStart}
          onDragEnd={this.onDragEnd}
        >
          <Fragment>
            <Header>
              <LayoutControl>
                Current layout: <code>{this.state.layout}</code>
                <button type="button" onClick={this.toggleTableLayout}>
                  Toggle
                </button>
              </LayoutControl>
              <div>
                Copy table to clipboard:
                <CopyTableButton onClick={this.copyTableToClipboard}>
                  Copy
                </CopyTableButton>
              </div>
            </Header>
            <Table layout={this.state.layout}>
              <THead>
                <tr>
                  <th>Author</th>
                  <th>Content</th>
                </tr>
              </THead>
              <Droppable
                droppableId="table"
                renderClone={(
                  provided: DraggableProvided,
                  snapshot: DraggableStateSnapshot,
                  rubric: DraggableRubric,
                ) => (
                  <TableRow
                    provided={provided}
                    snapshot={snapshot}
                    quote={this.state.quotes[rubric.source.index]}
                  />
                )}
                getContainerForClone={() => tbody}
              >
                {(droppableProvided: DroppableProvided) => (
                  <TBody
                    ref={(ref: HTMLElement | null) => {
                      this.tableRef = ref;
                      droppableProvided.innerRef(ref);
                    }}
                    {...droppableProvided.droppableProps}
                  >
                    {this.state.quotes.map((quote: Quote, index: number) => (
                      <Draggable
                        draggableId={quote.id}
                        index={index}
                        key={quote.id}
                      >
                        {(
                          provided: DraggableProvided,
                          snapshot: DraggableStateSnapshot,
                        ) => (
                          <TableRow
                            provided={provided}
                            snapshot={snapshot}
                            quote={quote}
                          />
                        )}
                      </Draggable>
                    ))}
                    {droppableProvided.placeholder}
                  </TBody>
                )}
              </Droppable>
            </Table>
          </Fragment>
        </DragDropContext>
      </IsDraggingContext.Provider>
    );
  }
}
