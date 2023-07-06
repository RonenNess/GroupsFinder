# groups-finder-js

A small JS utility to locate groups of common values in a 2D grid.
For example you can use this to find sprites boundaries in a texture atlas (by finding "islands" of opaque pixels and treating transparent pixels as separators).

This module is geared toward textures and locating groups of pixels in them, but built with a generic design that allows it to operate on any 2D grid of values.

An online demo can be found [here](https://ronenness.github.io/GroupsFinder/).

## How it works

The groups finder uses a flood-fill algorithm to iterate and arrange values (or pixels) into groups. Each group may contain the value indices themselves (its configurable, since it requires a lot of memory to store) and the axis-aligned rectangle containing the group.

The result of the groups search is a list of `Group` objects, with the following fields:

- **topLeft**: A point (x,y) with the top-left corner of the rectangle containing this group.
- **bottomRight**: A point (x,y) with the bottom-right corner of the rectangle containing this group.
- **boundingRectangle**: A minimal axis-aligned rectangle (x, y, width, height) containing the group.
- **positionsCount**: How many positions were found in the group.
- **positions**: List of positions found in this group, only if configured to return this value.

## Install

To use this module either take the `src/groups_finder.js` JavaScript file and include it in your browser (everything is in a single file), or use `npm install groups-finder` to use it from NodeJS.

## Examples

Lets show few quick examples on how to use this library.

### Unpack Texture Atlas

This example show how to unpack sprites from a texture atlas, by finding groups of opaque pixels between transparent pixels which are the background. We set `storePositions = false` so we won't store the pixels themselves in the result, as we only care about the bounding rectangle and not all the indices.

Important to remember: since we must extract the pixels data from the image, this module will not work on cross-domain assets or files served from local filesystem directly (when you load an HTML file by clicking it instead of serving it via a server). This is due to browsers security limitations, but shouldn't be an issue for any usual use cases.

```js
// unpack texture atlas
const groupsFinder = new GroupsFinder.GroupsFinder();
groupsFinder.storePositions = false;
const groups = groupsFinder.unpackTextureAtlas(sourceImg);

// print sprites found in texture
for (let group of groups) {
    console.log("Sprite found with source rectangle: ", group.boundingRectangle);
}
```

### Find Color Groups

This example find groups of the same color in a texture.

```js
// find colors groups
const groupsFinder = new GroupsFinder.GroupsFinder();
groupsFinder.storePositions = false;
const groups = groupsFinder.findColorGroups(sourceImg);

// print sprites found in texture
for (let group of groups) {
    console.log("Color groups found in texture: ", group.boundingRectangle);
}
```

## Advanced Topics

After viewing some basic examples, lets dive into the API to learn more about this library and what we can do with it.

### GroupsFinder

The main object in this library is the `GroupsFinder` class. This object provides the main methods to find groups + some basic configuration.

You create an instance of it like this:

```js
const groupsFinder = new GroupsFinder.GroupsFinder();
```

Now lets see the configurations it supports:

- **storePositions**: If true (default), result groups will also contain a list with all the indices in group. If you don't need this data, its best to set this to false (will save time and memory).
- **walkDiagonally**: If true (default), will also consider diagonal neighbors in the grouping process.
- **limitResultsCount**: If defined with a value > 0, will limit max results returned to this value. If exceed the limit, an exception will be thrown (with the results we already found attached as 'results').

And to actually use this object, there are 3 main public methods to call:

- **unpackTextureAtlas(image, opacityThreshold = 10)**: Find groups of pixels in a texture atlas (unpack it to sprites data).
- **findColorGroups(image, opacityThreshold = 10)**: Find groups of the same color in a texture.
- **findGroups(grid)**: A generic method to find groups in any type of 2D grid, not necessarily images. To understand how it works, lets continue and read about the IGrid interface (which is the grid param this method gets) and how to use it.

### IGrid

Most of this library logic is implemented inside `findGroups(grid)`, which relies on an `IGrid` object to provide information about the 2D grid and how we compare and extract values from it.

The other main methods `unpackTextureAtlas()` and `findColorGroups()` actually use `findGroups(grid)` internally, with a built-in `IGrid` implementation that support images as input for the 2D grid.

Now lets take a look at the IGrid interface and what we need to implement in it:

- **get width()**: A getter that return your grid width. Must not change mid-execution.
- **get height()**: A getter that return your grid height. Must not change mid-execution.
- **getValue(x, y)**: A method that returns a value from grid in a given x,y index, or null to represent out-of-bounds or "holes" in the grid that you don't want to group with anything.
- **sameGroup(a, b)**: A method that receive two values from grid and decide if they should be in the same group or not. Default implementation is `a === b`, but you can override this to add more sophisticated logic (for example consider *similar* values as the same group, instead of strict equal values).

To use images with the algorithm this module provides a built-in grid implementation called `TextureGrid`, that knows how to handle images and extract their pixels data.

As you can see, by implementing your own `IGrid` type you can define your own comparison logic and a way to extract values, making this library flexible and useable for many purposes.

## License

This library is distributed with the free MIT license.
