/**
 * This module provide a simple utility to find groups of common values in a 2D grid.
 * For example you can use this to unpack a texture atlas, find groups of same-color pixels, or not even use it with images but raw data you define.
 * To use this module either install it via npm, or just include this JS in your webpage.
 * @author Ronen Ness
 * @since 2023
 * @license MIT
 */

(function () {
    /**
     * A group found in the grid.
     */
    class Group
    {
        /**
         * Create the group with empty values.
         */
        constructor()
        {
            /**
             * A point with the top-left corner of the rectangle containing this group.
             */
            this.topLeft = {x: Number.MAX_SAFE_INTEGER, Y: Number.MAX_SAFE_INTEGER};

            /**
             * A point with the bottom-right corner of the rectangle containing this group.
             */
            this.bottomRight = {x: Number.MIN_SAFE_INTEGER, Y: Number.MIN_SAFE_INTEGER};

            /**
             * A minimal axis-aligned rectangle containing the group.
             */
            this.boundingRectangle = {x: 0, y: 0, width: 0, height: 0};

            /**
             * How many positions were found in the group.
             */
            this.positionsCount = 0;

            /**
             * List of positions found in this group.
             * Only available if the group finder is set to record these values.
             */
            this.positions = [];
        }
    }


    /**
     * A grid provider, to give information about the grid we want to find the groups in.
     */
    class IGrid
    {
        /**
         * Get grid width.
         * @returns {Number} Grid width.
         */
        get width()
        {
            throw new Error("Not Implemented: IGrid.width");
        }

        /**
         * Get grid height.
         * @returns {Number} Grid height.
         */
        get height()
        {
            throw new Error("Not Implemented: IGrid.height");
        }

        /**
         * Get grid value at a given index.
         * Value must be something comparable, as the group finder will use this to decide if two values belong to the same group or not.
         * @param {Number} x Index X.
         * @param {Number} y Index Y.
         * @returns {*|null} Value at given index, or null if you want to consider it as a 'hole' that doesn't belong to any group.
         */
        getValue(x, y)
        {
            throw new Error("Not Implemented: IGrid.getValue()");
        }

        /**
         * Check if two values from grid are equal (should be in the same group) or not.
         * By default it just compare with ===, but you can override this if you want to implement more sophisticated comparisons.
         * For example, you can use this to compare colors and consider similar color as the same color.
         * @param {*} a First value.
         * @param {*} b Second value.
         * @returns {Boolean} True if values are equal (same group) false otherwise.
         */
        sameGroup(a, b)
        {
            return a === b;
        }
    }

    /**
     * A grid provider to handle textures.
     */
    class TextureGrid extends IGrid
    {
        /**
         * Create the texture grid provider from a source image.
         * @param {Image} img Source image. Must be loaded and renderable on a canvas (ie not cross origin).
         * @param {Number} opacityThreshold Pixels with alpha value lower than this will be considered as "holes" and will not be included in any group.
         */
        constructor(img, opacityThreshold = 15)
        {
            super();

            // create a canvas and draw image on it
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0,0);

            // store image, context, and pixels
            this.img = img;
            this.ctx = ctx;
            this.pixels = ctx.getImageData(0, 0, img.width, img.height).data;

            // store opacity threshold
            this.opacityThreshold = opacityThreshold || 0;

            /**
             * Method to process a value we read from image before we return it.
             * Default implementation returns the pixel color as #rrggbbaa.
             * Set this method to 'null' to simply consider all values as '1', effectively grouping by either null values or existing values.
             */
            this.processValue = (r, g, b, a) => '#' + [r, g, b, a].map(x => x.toString(16).padStart(2, '0')).join('');
        }

        /** @inheritdoc */
        get width()
        {
            return this.img.width;
        }

        /** @inheritdoc */
        get height()
        {
            return this.img.height;
        }

        /** @inheritdoc */
        getValue(x, y)
        {
            // if out of bounds return null
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) { return null; }

            // calculate index in pixels data
            let index = (x + y * this.width) * 4;

            // check if transparent pixel
            if (this.pixels[index + 3] < this.opacityThreshold) {
                return null;
            }

            // special - no process value method
            if (this.processValue === null) {
                return 1;
            }

            // return value
            return this.processValue(this.pixels[index++], this.pixels[index++], this.pixels[index++], this.pixels[index++]);
        }
    }


    /**
     * Find groups in 2D grids.
     * @description
     * A utility to find groups of common values in a 2D grid, and provide information about them.
     * It's main purpose is to break a texture atlas into multiple textures based on transparent pixels, but its written in a flexible way so you can use it for other purposes.
     * This utility works by running a simple flood-fill algorithm to find the min-max indices of groups.
     * @example
     * let groupsFinder = new GroupsFinder();
     * groupsFinder.storePositions = false; // we only care about bounding rectangles 
     * let sprites = groupsFinder.unpackTextureAtlas(someImage);
     * for (let sprite of sprites) {
     *   console.log(`sprite found in atlas: `, sprite.boundingRectangle);
     * }
     * @author
     * Ronen Ness
     * 2023
     */
    class GroupsFinder 
    {
        /**
         * Create the groups finder.
         */
        constructor()
        {
            /**
             * If true, will keep positions information in result Groups.
             * This can be costly for some use cases, so you can disable it by setting this flag to false.
             */
            this.storePositions = true;

            /**
             * If true, will consider diagonal neighbors in the same group, if they share the same value.
             */
            this.walkDiagonally = true;

            /**
             * If defined (> 0) will stop iteration after finding this number of groups.
             * This is important if you try to run untrusted input from users, to avoid crashing the browser on memory usage.
             * If this limit is exceeded, an exception will be thrown with '.results' attached to the error object.
             */
            this.limitResultsCount = 0;
        }

        /**
         * Takes an image and find groups of same color in it.
         * @param {Image} image Fully loaded image to find groups in. Note: must be an image loaded in a way we can render with the canvas API (for example, cross-domain images won't work).
         * @param {Number} opacityThreshold Pixels with opacity less than this value will be considered as transparent pixels and will not be counted as a color.
         * @returns {Array<Group>} Array of groups found in texture.
         */
        findColorGroups(image, opacityThreshold = 10)
        {
            // create a texture grid provided
            const grid = new TextureGrid(image, opacityThreshold);

            // find groups
            return this.findGroups(grid);
        }

        /**
         * Takes an image representing a texture atlas and find all the sprites in it, by locating groups of non-transparent pixels.
         * @param {Image} image Fully loaded image to unpack as texture atlas. Note: must be an image loaded in a way we can render with the canvas API (for example, cross-domain images won't work).
         * @param {Number} opacityThreshold Pixels with opacity less than this value will be considered as transparent pixels and a separation between sprites.
         * @returns {Array<Group>} Array of sprites found in texture.
         */
        unpackTextureAtlas(image, opacityThreshold = 10)
        {
            // create a texture grid provided
            const grid = new TextureGrid(image, opacityThreshold);

            // this will just return 1, unless the pixel is transparent. 
            // in other words, it will find groups by transparent / visible pixels.
            grid.processValue = null;

            // unpack the texture atlas
            return this.findGroups(grid);
        }

        /**
         * Find and return a list of groups in a group provider.
         * @param {IGrid} grid Grid implementation to find groups in.
         * @returns {Array<Group>} Array of groups found in grid.
         */
        findGroups(grid)
        {
            // indices we already processed
            const processed = new Set();

            // find the bounding rectangle of a cluster of values, starting from the index of any valid position in the cluster
            // this uses a naive flood fill algorithm
            const findClusterGroup = (startValue, startX, startY) => 
            {
                // to store positions / count values
                const positions = [];
                var positionsCount = 0;

                // will contain top-left and bottom-right values
                const topLeft = {x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER};
                const bottomRight = {x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER};

                // flood-fill group until we hit a hole or a different value
                // _toContinue is a quick and dirty patch to avoid max stack limit reach on large clusters (we basically do recursion but break and continue if about to hit limit).
                var _toContinue = [];
                const fill = (x, y, callStackDepth) => {
                
                    // trick to prevent max stack limit reach
                    if (callStackDepth++ > 1000) {
                        _toContinue.push([x,y]);
                        return;
                    }

                    // stop conditions - out of bounds
                    if(x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
                        return;
                    }
            
                    // stop condition - already processed this index
                    const key = `${x},${y}`;
                    if (processed.has(key)) {
                        return;
                    }
                    processed.add(key);
                
                    // get current value
                    const value = grid.getValue(x, y);

                    // if we hit a hole or different value, skip it
                    if ((value === null) || !grid.sameGroup(value, startValue)) {
                        return;
                    }
                
                    // update positions and positions count
                    positionsCount++;
                    if (this.storePositions) {
                        positions.push([x, y]);
                    }

                    // update top-left / bottom-right values
                    topLeft.x = Math.min(topLeft.x, x);
                    topLeft.y = Math.min(topLeft.y, y);
                    bottomRight.x = Math.max(bottomRight.x, x);
                    bottomRight.y = Math.max(bottomRight.y, y);
                
                    // fill in all four directions
                    fill(x - 1, y, callStackDepth);
                    fill(x + 1, y, callStackDepth);
                    fill(x, y - 1, callStackDepth);
                    fill(x, y + 1, callStackDepth);

                    // add diagonal walks
                    if (this.walkDiagonally) {
                        fill(x - 1, y - 1, callStackDepth);
                        fill(x - 1, y + 1, callStackDepth);
                        fill(x + 1, y - 1, callStackDepth);
                        fill(x + 1, y + 1, callStackDepth);
                    }
                }

                // begin flood fill algorithm to find corners of current group
                // note: _toContinue is used to prevent stack overflow and continue from where we stopped
                _toContinue = [];
                fill(startX, startY, 0);

                // do the parts we skipped to avoid max stack limit
                while (_toContinue.length) {
                    const curr = _toContinue.pop();
                    fill(curr[0], curr[1], 0);
                }
                
                // build and return the result
                const result = new Group();
                result.topLeft = topLeft;
                result.bottomRight = bottomRight;
                result.positionsCount = positionsCount;
                result.positions = positions;
                result.boundingRectangle = {x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y};
                return result;
            };
            
            // data to return
            const ret = [];

            // iterate grid and find groups
            for (let x = 0; x < grid.width; ++x) {
                for (let y = 0; y < grid.height; ++y) {

                    // skip if already processed
                    if (processed.has(`${x},${y}`)) {
                        continue;
                    }

                    // get current value
                    const value = grid.getValue(x, y);

                    // skip holes
                    if (value === null) {
                        continue;
                    }

                    // extract current bounding rect
                    const result = findClusterGroup(value, x, y);
                    ret.push(result);

                    // check if exceeded max results
                    if (this.limitResultsCount != 0 && ret.length > this.limitResultsCount) {
                        let err = new Error("Exceeded max results count!");
                        err.results = ret;
                        throw err;
                    }
                }
            }

            // return results
            return ret;
        }
    }

    // object to export
    const _GroupsFinder = {Group: Group, IGrid: IGrid, TextureGrid: TextureGrid, GroupsFinder: GroupsFinder};

    // export as module
    if (typeof module !== 'undefined') {
        module.exports = _GroupsFinder;
    }
    // attach to window
    else if (typeof window !== 'undefined') {
        window.GroupsFinder = _GroupsFinder;
    }
    // attach to global
    else if (typeof global !== 'undefined') {
        global.GroupsFinder = _GroupsFinder;
    }
    else {
        console.error("Couldn't find any supported method to export to!");
    }

})();