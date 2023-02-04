const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItAttrs = require('markdown-it-attrs');
var implicitFigures = require('markdown-it-implicit-figures');

const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginNavigation = require("@11ty/eleventy-navigation");
const pluginToc = require('eleventy-plugin-toc');
const pluginTP = require('@teipublisher/pb-eleventy-plugin');
const pluginFavicon = require("eleventy-favicon");

const Image = require("@11ty/eleventy-img");

async function imageShortcode(src, alt) {
  if(alt === undefined) {
    // You bet we throw an error on missing alt (alt="" works okay)
    throw new Error(`Missing \`alt\` on myImage from: ${src}`);
  }

  const imageName = path.basename(src);
  const metadata = await Image(`img/${imageName}`, {
    widths: [300],
    formats: ["jpeg"],
    outputDir: "./_site/img/",
  });

  const data = metadata.jpeg[metadata.jpeg.length - 1];
  return `<img src="${data.url}" alt="${alt}" title="${alt}" data-bs-toggle="tooltip" loading="lazy" decoding="async">`;
}

module.exports = function(eleventyConfig) {
  // Copy the `img` and `css` folders to the output
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("resources");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy({
    "./node_modules/bootstrap/dist/js/bootstrap.bundle.min.js": "assets/scripts/bootstrap.bundle.min.js",
    "./node_modules/bootstrap/dist/css/bootstrap.min.css": "assets/css/bootstrap.min.css",
    "./node_modules/bootstrap-icons/font/bootstrap-icons.css": "assets/css/bootstrap-icons.css",
    "./node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff": "assets/css/fonts/bootstrap-icons.woff",
    "./node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2": "assets/css/fonts/bootstrap-icons.woff2",
    "./node_modules/rellax/rellax.min.js": "assets/scripts/rellax.min.js",
    "./node_modules/leaflet/dist/leaflet.js": "assets/scripts/leaflet.js",
    "./node_modules/leaflet/dist/leaflet.css": "assets/css/leaflet.css",
    "./node_modules/leaflet/dist/images/*.png": "assets/css/images",
    "./node_modules/leaflet.markercluster/dist/leaflet.markercluster.js": "assets/scripts/leaflet.markercluster.js",
    "./node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css": "assets/css/MarkerCluster.Default.css",
    "./node_modules/leaflet.markercluster/dist/MarkerCluster.css": "assets/css/MarkerCluster.css"
  });

  // Add plugins
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginNavigation);
  eleventyConfig.addPlugin(pluginToc, { ul: true });
  eleventyConfig.addPlugin(pluginFavicon);
  eleventyConfig.addPlugin(pluginTP);

  eleventyConfig.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat("dd LLL yyyy");
  });

  eleventyConfig.addFilter("hasTag", (tagList, tag) => {
    return tagList.indexOf(tag) > -1;
  });

  // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  eleventyConfig.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat('yyyy-LL-dd');
  });

  // Get the first `n` elements of a collection.
  eleventyConfig.addFilter("head", (array, n) => {
    if(!Array.isArray(array) || array.length === 0) {
      return [];
    }
    if( n < 0 ) {
      return array.slice(n);
    }

    return array.slice(0, n);
  });

  // Return the smallest number argument
  eleventyConfig.addFilter("min", (...numbers) => {
    return Math.min.apply(null, numbers);
  });

  eleventyConfig.addFilter("excludeDrafts", (posts) => 
    posts.filter(post => post.data.tags.indexOf("draft") === -1)
  );

  function filterTagList(tags) {
    return (tags || []).filter(tag => ["all", "nav", "static", "posts"].indexOf(tag) === -1);
  }

  eleventyConfig.addFilter("filterTagList", filterTagList)

  // Create an array of all tags
  eleventyConfig.addCollection("tagList", function(collection) {
    let tagSet = new Set();
    collection.getAll().forEach(item => {
      (item.data.tags || []).forEach(tag => tagSet.add(tag));
    });

    const tags = filterTagList([...tagSet]);
    const tagMap = new Map();
    tags.forEach(tag => {
      const items = collection.getFilteredByTag(tag);
      tagMap.set(tag, items.length);
    });
    return tagMap;
  });

  eleventyConfig.addCollection('markdown', collection => {
    return [...collection.getFilteredByGlob('./**/*.md')];
  });

  function normalizeContent(content) {
    return content
      .replace(/!\[[^\]*\]\([^\)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
      .replace(/^`{2,}.*^`{2,}/gsm, '')
      .replace(/#+/g, '')
      .replace(/\n/g, ' ');
  }

  eleventyConfig.addFilter('search', function(collection) {
    const index = [];
    collection.forEach(page => {
      index.push({
        id: page.url,
        title: page.template.frontMatter.data.title.replace(/\n/g, ' '),
        content: normalizeContent(page.template.frontMatter.content),
        tags: page.template.frontMatter.data.tags
      });
    });
    return index;
  });

  eleventyConfig.addNunjucksAsyncShortcode("thumb", imageShortcode);

  // Customize Markdown library and settings:
  let markdownLibrary = markdownIt({
    html: true,
    linkify: true
  })
  .use(markdownItAnchor)
  .use(markdownItAttrs)
  .use(implicitFigures, {
    dataType: false,  // <figure data-type="image">, default: false
    figcaption: true,  // <figcaption>alternative text</figcaption>, default: false
    tabindex: false, // <figure tabindex="1+n">..., default: false
    link: false // <a href="img.png"><img src="img.png"></a>, default: false
  });
  eleventyConfig.setLibrary("md", markdownLibrary);

  // Override Browsersync defaults (used only with --serve)
  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: function(err, browserSync) {
        const content_404 = fs.readFileSync('_site/404.html');

        browserSync.addMiddleware("*", (req, res) => {
          // Provides the 404 content without redirect.
          res.writeHead(404, {"Content-Type": "text/html; charset=UTF-8"});
          res.write(content_404);
          res.end();
        });
      },
    },
    ui: false,
    ghostMode: false
  });

  return {
    // Control which files Eleventy will process
    // e.g.: *.md, *.njk, *.html, *.liquid
    templateFormats: [
      "md",
      "njk",
      "html",
      "liquid"
    ],

    // Pre-process *.md files with: (default: `liquid`)
    markdownTemplateEngine: "njk",

    // Pre-process *.html files with: (default: `liquid`)
    htmlTemplateEngine: "njk",

    // -----------------------------------------------------------------
    // If your site deploys to a subdirectory, change `pathPrefix`.
    // Don’t worry about leading and trailing slashes, we normalize these.

    // If you don’t have a subdirectory, use "" or "/" (they do the same thing)
    // This is only used for link URLs (it does not affect your file structure)
    // Best paired with the `url` filter: https://www.11ty.dev/docs/filters/url/

    // You can also pass this in on the command line using `--pathprefix`

    // Optional (default is shown)
    pathPrefix: "/",
    // -----------------------------------------------------------------

    // These are all optional (defaults are shown):
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
