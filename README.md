# graph-editor
Force-Directed Graph Editor

This web application is a graph editor that uses the [force-graph library](https://github.com/vasturiano/force-graph/) with the [d3-force simulation library](https://d3js.org/d3-force). Much of the code was written with help from [Cursor](https://www.cursor.com/).

The application has a drawing surface that displays graphs that have nodes and links (undirected edges). While the force-graph and D3 libraries support large graphs, this application is intended to be used with relatively small graphs that are edited by humans.

The application also has a sidebar with four tools. The Node tool is used to create and to modify graph nodes. The link tool is used to create links between pairs of nodes. The color tool is used to specify the color of both links and nodes. The Graph tool is used for graph-wide operations (auto layout, save, and load).
