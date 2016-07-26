/**
Main script for the gathering and visualization of the files and folders

Created by Rohan Dhoopar in 2016
**/

//Kloudless information
var KLOUDLESS_APPID = "gydGdNqH2Q7JzMYZIYwL_nH6oUMSMCOIB8JSzJsbnHk5L9iS";
var KLOUDLESS_TOKEN; //dynamically generated, never exposed

//Node array and object for d3
var nodes = [];
function node(id, size, type, start, name, modified) {
  this.id = id;
  this.size = size;
  this.type = type;
  this.start = start;
  this.name = name;
  this.modified = modified;
}

//Link array and object
var links = [];
function link(source, target) {
  this.source = source;
  this.target = target;
}

var selected = "";  //Will become the starting folder's name
var accountId;      //Will become the user's account Id, needed for Kloudless
var sticky = false; //Toggleable stickiness feature

//Main method that controls gathering and visualization of data
function main() {

  //instance of the Kloudless explorer
  var explorer = window.Kloudless.explorer({
    app_id: KLOUDLESS_APPID,
    multiselect: false,
    link: true,
    create_folder: false,
    types: ['folders'],
    services: ['dropbox'],
    retrieve_token: true
  });

  explorer.choosify(document.getElementById('file-explorer'));

  //Gathering and visualization logic after starting folder has been selected
  explorer.on('success', function(folder) {
    sweetAlert("Starting folder selected!", "Now generating the visualization. It will automatically display when ready.", "success");
    selected = folder[0];
    KLOUDLESS_TOKEN = selected.bearer_token.key;
    accountId = selected.account;
    nodes = [];
    links = [];

    //Push and get children of starting folder, synchronously the first time
    nodes.push(new node(selected.id, null, "folder", true, selected.name, selected.modified));
    var children = list_children(selected.id);

    //Get rest of children asynchronously 
    populate_async(children, selected.id);

    //Begin visualizaiton once all async calls are complete
    $(document).ajaxStop(function() {
      clear_svg();
      //console.log(nodes);
      //console.log(links);
      display();
    });
  });

  //error handling
  explorer.on('error', function(error) {
    alert("Your cloud seems to be unavailable. Please try again later.");
  });
}
//Need to call main to initialize the explorer
try {
  main();
}
catch(e) {
  sweetAlert("An error occurred :(", "Please reload the page and try again", "error");
}

//Lists the children of a folder synchronously
function list_children(id) {
  var url = "https://api.kloudless.com/v0/accounts/" + accountId + "/folders/" + id + "/contents";
  var xhttp = new XMLHttpRequest();
  xhttp.open("GET", url, false); //the false makes it synchronous
  xhttp.setRequestHeader("Authorization", "Bearer " + KLOUDLESS_TOKEN);
  xhttp.setRequestHeader("Content-Type", "application/json");
  try {
    xhttp.send();
  }
  catch(e) {
    alert("Kloudless could not access all your files; some may be missing from the visualization. You may want to try again or refresh the page.");
  }
  //console.log(JSON.parse(xhttp.responseText));
  return JSON.parse(xhttp.responseText).objects;
}

//Lists the children of a folder asynchronously
function list_children_async(id) {
  $.ajax({
     url: "https://api.kloudless.com/v0/accounts/" + accountId + "/folders/" + id + "/contents",
     type: "GET",
     beforeSend: function(xhr){
      xhr.setRequestHeader('Authorization', 'Bearer ' + KLOUDLESS_TOKEN);
      xhr.setRequestHeader('Content-Type', "application/json");
    },
     success: function(result) { 
      //console.log(result);
      populate_async(result.objects, id); //Mutually recursive call to the populate_async method
    }
  });
}

//Get metadata (name, size, modified, etc) of a given file from Kloudless
function get_file_metadata(id) {
  var url = "https://api.kloudless.com/v0/accounts/" + accountId + "/files/" + id;
  var xhttp = new XMLHttpRequest();
  xhttp.open("GET", url, false);
  xhttp.setRequestHeader("Authorization", "Bearer " + KLOUDLESS_TOKEN);
  xhttp.setRequestHeader("Content-Type", "application/json");
  try {
    xhttp.send();
  }
  catch(e) {
    alert("Kloudless could not access all your files; some may be missing from the visualization. You may want to try again or refresh the page.");
  }
  return JSON.parse(xhttp.responseText);
}

//Get metadata (name, size, modified, etc) of a given folder from Kloudless
function get_folder_metadata(id) {
  var url = "https://api.kloudless.com/v0/accounts/" + accountId + "/folders/" + id;
  var xhttp = new XMLHttpRequest();
  xhttp.open("GET", url, false);
  xhttp.setRequestHeader("Authorization", "Bearer " + KLOUDLESS_TOKEN);
  xhttp.setRequestHeader("Content-Type", "application/json");
  try {
    xhttp.send();
  }
  catch(e) {
    alert("Kloudless could not access all your files; some may be missing from the visualization. You may want to try again or refresh the page.");
  }
  return JSON.parse(xhttp.responseText);
}

//Deprecated
//Method to recursively get all children (synchronously)
function populate(startId) {
  var children = list_children(startId);
  if (children) {
    for (var i = 0; i < children.length; i++) {
      //console.log(children[i].id);
      nodes.push(new node(children[i].id, children[i].size, children[i].type, false, children[i].name, children[i].modified));
      links.push(new link(startId, children[i].id));
      if (children[i].type === "folder") {
        populate(children[i].id);
      }
    }
  }
}

//Method to recursively get all children (asynchronously)
function populate_async(children, startId) {
  if (children) {
    for (var i = 0; i < children.length; i++) {
      //console.log(children[i].id);
      nodes.push(new node(children[i].id, children[i].size, children[i].type, false, children[i].name, children[i].modified));
      links.push(new link(startId, children[i].id));
      if (children[i].type === "folder") {
        list_children_async(children[i].id); //Mutually recursive call to the list_children_async method 
      }
    }
  }
}

//Prints arrays to console
function print() {
  console.log(JSON.stringify(nodes));
  console.log(JSON.stringify(links));
}

//Handles the d3 visualization logic
function display() {
  //Use a new array edges (allows d3 to use String id's rather than numeric id's)
  var edges = [];
  links.forEach(function(e) {
      var sourceNode = nodes.filter(function(n) {
          return n.Id === e.Source;
      })[0],
          targetNode = nodes.filter(function(n) {
              return n.Id === e.Target;
          })[0];

      edges.push({
          source: sourceNode,
          target: targetNode
      });
  });

  //Width and height of the SVG that will be added
  var width = $(window).width();
  var height = $(window).height();
  
  //Scale width and height based on number of nodes
  var factor = 1;
  if (nodes.length > 250) {
    factor = 1.5; 
  }
  if (nodes.length > 500) {
    factor = 2;
  }
  if (nodes.length > 1000) {
    factor = 3;
  }
  if (nodes.length > 2000) {
    factor = 4;
  }
  width *= factor; 
  height *= factor; 

  //Add the SVG element to body
  var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height - 60);

  //Tooltip creation
  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function (d) {
        //Add "Name: " and name
        var title = "<span style=\"color:#ff9b37;\">Name: </span>" + d.name;
        title += "<br><span style=\"color:#ff9b37;\">Size: </span>";

        //Add "Size: " and size
        if (d.size != null) {
          title += (d.size/1024).toFixed(2) + " KB";
        }
        else title += "Folder";

        //Add "Modified: " and date last modified
        title += "<br><span style=\"color:#ff9b37;\">Modified: </span>"
        if (d.modified != null) {
          title += d.modified.substring(0, 10);
        }
        else title += "N/A";
        return title;
      });
  svg.call(tip);

  //Deprecated
  //Tooltip creation using the "title" attribute
    // node.append("title")
    //   .text(function (d) {
    //     var title = "Name: " + d.name;
    //     title += "\n\nSize: ";
    //     if (d.size != null) {
    //       title += (d.size/1024).toFixed(2) + " KB";
    //     }
    //     else title += "Folder";
    //     title += "\n\nModified: "
    //     if (d.modified != null) {
    //       title += d.modified.substring(0, 10);
    //     }
    //     else title += "N/A";
    //     title += "\n\nPath: " + d.path;
    //     return title;
    //   });

  //Begin the d3 force simulation
  var force = d3.forceSimulation()
    .force("charge", d3.forceManyBody().strength(-50))
    .force("link", d3.forceLink().id(function(d) { return d.id }).distance(15))
    //.force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX(width/2))
    .force("y", d3.forceY(height/2));

  //Enter the links
  var link = svg.append("g")
    .selectAll(".link")
    .data(links)
    .enter().append("line")
    .attr("class", "link");

  //Enter the nodes
  var node = svg.append("g")
    .selectAll(".node")
    .data(nodes)
    .enter().append("circle")
      .attr("class", "node")

      //Base node size on the file size
      .attr("r", function(d) {
        if (d.size == null) return 7;
        var size = d.size/20000;
        if (size < 2) return 2;
        else if (size > 12) return 12;
        else return size;
      })

      //Base node fill color on what it represents
      .style("fill", function(d) {
        if (d.start) return "#ff9cce";
        else if (d.type === "folder") return "#9cceff";
        else return "#ceff9c";
      })

      //Mouseover and drag logic
      .on("mouseover", modify(.1, 5))
      .on("mouseout", modify(1, 0))
      .call(d3.drag()
        .on("start", startdrag)
        .on("drag", dragging )
        .on("end", enddrag));

  //Add the nodes and links to the force simulation
  force
    .nodes(nodes)
    .on("tick", tick)
    .force("link")
    .links(links);

  //Create and populate map of which nodes are linked to one another
  var linkedByIndex = {};
  links.forEach(function(d) {
      linkedByIndex[d.source.index + "," + d.target.index] = 1;
  });

  //Check the map to see if two nodes are connected
  function isConnected(a, b) {
      return linkedByIndex[a.index + "," + b.index] || linkedByIndex[b.index + "," + a.index] || a.index == b.index;
  }

  //Check the map to see if one node is a child of another 
  function isChild(a, b) {
      return linkedByIndex[a.index + "," + b.index] || a.index == b.index;
  }

  //Advances the simulation one time step
  function tick() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  }

  //Modifies the nodes when one is hovered over
  function modify(opacity, size) {
    return function(d) {
      //Makes all the non connected nodes transparent
      node.style("stroke-opacity", function(o) {
          thisOpacity = isConnected(d, o) ? 1 : opacity;
          this.setAttribute('fill-opacity', thisOpacity);
          return thisOpacity;
      });

      //Makes all the non connected edges transparent
      link.style("stroke-opacity", function(o) {
          return o.source === d || o.target === d ? 1 : opacity;
      });

      //Displays the tooltip
      if (opacity == 1) {
        tip.hide(d);
      }
      else tip.show(d);

      //Increases/decreases the size of hovered node
      d3.select(this)
      .transition()
      .duration(150)
      .attr("r", function(d) {
        if (d.size == null) return 7 + size;
        var old_size = d.size/20000;
        if (old_size < 2) return 2 + size; 
        else if (old_size > 12) return 12 + size;
        else return old_size + size; 
      });
    };
  }

  //What to do when dragging begins, based on whether or not sticky is true
  function startdrag(d) {
    if (sticky) {
      force.alphaTarget(0.4).restart();
    }

    else {
      if (!d3.event.active) {
        force.alphaTarget(0.25).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
    }

  }

  //What to do during dragging 
  function dragging(d) {
    if (sticky) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
      d.x += d3.event.dx;
      d.y += d3.event.dy; 
      tick();
    }

    else {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

  }

  //What to do after dragging
  function enddrag(d) {
    if (sticky) {
      tick();
      force.alphaTarget(0).restart();
    }

    else {
      if (!d3.event.active) {
        force.alphaTarget(0);
      }
      d.fx = null;
      d.fy = null; //Setting fx and fy null is the key to making a node not stick
    }

  }

  //Push names of all the nodes to an array
  var optArray = [];
  for (var i = 0; i < nodes.length; i++) {
      optArray.push(nodes[i].name);
  }

  //Sort the array 
  optArray = optArray.sort();

  //Use the array for autocomplete
  $(function() {
      $("#search").autocomplete({
          source: optArray
      });
  });

  //Search function
  this.search = function() {
    var selectedVal = document.getElementById('search').value;
    var node = svg.selectAll(".node");

    //Ensure that search term is not empty string
    if (selectedVal != "") {
      //Filter nodes that are NOT the searched for node
      var selected = node.filter(function (d, i) {
          return d.name != selectedVal;
      });

      //Fade out then return to normal opacity after 4 seconds all those nodes 
      if (selected["_groups"][0].length != node["_groups"][0].length) {
        selected.style("opacity", "0");
        var link = svg.selectAll(".link")
        link.style("opacity", "0");
        d3.selectAll(".node, .link").transition()
            .duration(4000)
            .style("opacity", 1);
      }
    }
  }
}

//Allows search to be accessed by the HTML button
function search() {
  var searcher = new display()
  searcher.search();
}

//Toggles stickiness
function toggle_sticky() {
  sticky = !sticky;

  //Adjust inner HTML
  var sticky_button = document.getElementById("right");
  if (sticky) {
    sticky_button.innerHTML = "Click to toggle sticky nodes (currently ON)";
  }
  else {
    sticky_button.innerHTML = "Click to toggle sticky nodes (currently OFF)";
    
    //Set fx and fy of all nodes to null (key to making the node not stick)
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].fx = null;
      nodes[i].fy = null; 
    }
  }
}

//Removes the svg element
function clear_svg() {
  var svg = d3.select("svg").remove();
}