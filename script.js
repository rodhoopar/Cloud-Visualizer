var KLOUDLESS_APPID = "gydGdNqH2Q7JzMYZIYwL_nH6oUMSMCOIB8JSzJsbnHk5L9iS";
var KLOUDLESS_TOKEN;
var selected = "";
var nodes = [];
function node(id, size, type, start, name, modified) {
  this.id = id;
  this.size = size;
  this.type = type;
  this.start = start;
  this.name = name;
  this.modified = modified;
}
var links = [];
function link(source, target) {
  this.source = source;
  this.target = target;
}
var accountId; 
var sticky = false; 

function kloudless_populate() {
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
  explorer.on('success', function(folder) {
    sweetAlert("Starting folder selected!", "Requests to your cloud may take time -- they are limited to 10 per second. The visualization will automatically display when ready.", "success");
    selected = folder[0];
    KLOUDLESS_TOKEN = selected.bearer_token.key;
    accountId = selected.account;
    nodes = [];
    links = [];
    nodes.push(new node(selected.id, null, "folder", true, selected.name, selected.modified));
    // populate(selected.id);
    // clear_svg();
    // console.log("Sync version");
    // console.log(JSON.stringify(nodes));
    // console.log(JSON.stringify(links));
    // display();
    var children = list_children(selected.id);
    populate_async(children, selected.id);
    $(document).ajaxStop(function() {
      clear_svg();
      console.log("Async version");
      console.log(JSON.stringify(nodes));
      console.log(JSON.stringify(links));
      display();
    });
  });
  var error_count = 0;
  explorer.on('error', function(error) {
    alert("Your cloud seems to be unavailable. Please try again later.");
  });
}
kloudless_populate();

function list_children(id) {
  var url = "https://api.kloudless.com/v0/accounts/" + accountId + "/folders/" + id + "/contents";
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
  //console.log(JSON.parse(xhttp.responseText));
  return JSON.parse(xhttp.responseText).objects;
}

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
      populate_async(result.objects, id); 
    }
  });
}

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

function populate_async(children, startId) {
  if (children) {
    for (var i = 0; i < children.length; i++) {
      //console.log(children[i].id);
      nodes.push(new node(children[i].id, children[i].size, children[i].type, false, children[i].name, children[i].modified));
      links.push(new link(startId, children[i].id));
      if (children[i].type === "folder") {
        list_children_async(children[i].id);
      }
    }
  }
}

function print() {
  console.log(JSON.stringify(nodes));
  console.log(JSON.stringify(links));
}

function display() {
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
  var width = $(window).width();
  var height = $(window).height();

  var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height - 60);

  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function (d) {
        var title = "<span style=\"color:#ff9b37;\">Name: </span>" + d.name;
        title += "<br><span style=\"color:#ff9b37;\">Size: </span>";
        if (d.size != null) {
          title += (d.size/1024).toFixed(2) + " KB";
        }
        else title += "Folder";
        title += "<br><span style=\"color:#ff9b37;\">Modified: </span>"
        if (d.modified != null) {
          title += d.modified.substring(0, 10);
        }
        else title += "N/A";
        return title;
      });
  svg.call(tip);

  var force = d3.forceSimulation()
    .force("charge", d3.forceManyBody().strength(-50))
    .force("link", d3.forceLink().id(function(d) { return d.id }).distance(15))
    .force("x", d3.forceX(width/2))
    .force("y", d3.forceY(height/2))

  var link = svg.append("g")
    .selectAll(".link")
    .data(links)
    .enter().append("line")
    .attr("class", "link");

  var node = svg.append("g")
    .selectAll(".node")
    .data(nodes)
    .enter().append("circle")
      .attr("class", "node")
      .attr("r", function(d) {
        if (d.size == null) return 7;
        var size = d.size/20000;
        if (size < 2) return 2;
        else if (size > 12) return 12;
        else return size;
      })
      .style("fill", function(d) {
        if (d.start) return "#ff9cce";
        else if (d.type === "folder") return "#9cceff";
        else return "#ceff9c";
      })
      .on("mouseover", modify(.1, 5))
      .on("mouseout", modify(1, 0))
      .call(d3.drag()
        .on("start", startdrag)
        .on("drag", dragging )
        .on("end", enddrag));

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

  force
    .nodes(nodes)
    .on("tick", tick)
    .force("link")
      .links(links);

  // var bbox = svg.getBBox();
  // svg.setAttribute("viewBox", [bbox.x, bbox.y, bbox.width, bbox.height]);
  // svg.width.baseVal.valueAsString = bbox.width;
  // svg.height.baseVal.valueAsString = bbox.height;

  var linkedByIndex = {};
  links.forEach(function(d) {
      linkedByIndex[d.source.index + "," + d.target.index] = 1;
  });

  function isConnected(a, b) {
      return linkedByIndex[a.index + "," + b.index] || linkedByIndex[b.index + "," + a.index] || a.index == b.index;
  }

  function isChild(a, b) {
      return linkedByIndex[a.index + "," + b.index] || a.index == b.index;
  }

  function tick() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  }

  function modify(opacity, size) {
    return function(d) {
      node.style("stroke-opacity", function(o) {
          thisOpacity = isConnected(d, o) ? 1 : opacity;
          this.setAttribute('fill-opacity', thisOpacity);
          return thisOpacity;
      });

      link.style("stroke-opacity", function(o) {
          return o.source === d || o.target === d ? 1 : opacity;
      });

      if (opacity == 1) {
        tip.hide(d);
      }
      else tip.show(d);

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
      d.fy = null;
    }
  }

  var optArray = [];
  for (var i = 0; i < nodes.length; i++) {
      optArray.push(nodes[i].name);
  }
  optArray = optArray.sort();
  $(function () {
      $("#search").autocomplete({
          source: optArray
      });
  });

  this.search = function() {
    var selectedVal = document.getElementById('search').value;
    var node = svg.selectAll(".node");
    if (selectedVal != "") {
      var selected = node.filter(function (d, i) {
          return d.name != selectedVal;
      });
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

function search() {
  var searcher = new display()
  searcher.search();
}

function toggle_sticky() {
  sticky = !sticky;
  var sticky_button = document.getElementById("toggle_sticky");
  if (sticky) {
    sticky_button.innerHTML = "Click to toggle sticky nodes (currently ON)";
  }
  else {
    sticky_button.innerHTML = "Click to toggle sticky nodes (currently OFF)";
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].fx = null;
      nodes[i].fy = null; 
    }
  }
}

function clear_svg() {
  var svg = d3.select("svg").remove();
}