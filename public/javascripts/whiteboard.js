var path;

var hitOptions = {
    segments: true,
    stroke: true,
    fill: true,
    tolerance: 5
};

var pointlist = [];

var socket = io.connect('/');

function onMouseDown(event) {
	if(window.erase){
		var hitResult = project.hitTest(event.point, hitOptions);
		socket.emit("erase",{"name":hitResult.item.name});
		if (hitResult && hitResult.item){
			hitResult.item.remove();
		}


	} else {
		// If we produced a path before, deselect it:
		if (path) {
			path.selected = false;
		}

		path = new Path();
		path.name = new Date().getTime();
		path.strokeColor = 'black';
	}
}

function onMouseDrag(event) {
	path.add(event.point);	pointlist.push(event.point);
}

function onMouseUp(event) {
	var segmentCount = path.segments.length;
	
	path.simplify();
	//pathData = [];
	//pathData.points = pointlist;
	//pathData.uid = path.name;
	console.log({"uid":path.name,"points":pointlist});
	socket.emit("drawing_finished", {"uid":path.name,"points":pointlist});
	pointlist = [];
}

function onMouseMove(event) {
    var hitResult = project.hitTest(event.point, hitOptions);
    project.activeLayer.selected = false;
    if (hitResult && hitResult.item){
        hitResult.item.selected = true;
    }
}


socket.on('updatedrawing', function(data){
	var segments = [];
	$.each(data.points,function(){
		segments.push(new Point(this.x,this.y));
	});
	var path = new Path(segments);
	path.strokeColor = 'red';

	path.name = data.uid;
	project.activeLayer.addChild(path);
});

socket.on('erasepath', function(data){
	project.activeLayer.children[data.name].remove();
});