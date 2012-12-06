Haardvark
=========

Haardvark - for INFO3450, Cornell University, Fall 2012
_Designed by Parry Cadwallader, Julia Zhu, Jonathan O'Hanlon, and Catherine Ho_
_Programmed in Node.js by Parry Cadwallader_

Live Version
============
Can be found [here](http://parryc.com:3000/).

Current test users are 

* Lincoln
* Einstein
* Tester

There are no passwords

Setup
=====
Want to run this yourself? 

* Install [Mongo](http://www.mongodb.org/) and [Node.js](http://nodejs.org/)
* Clone this repository to your local machine
* Navigate to wherever you cloned it to
* Run ```npm install``` to install dependencies
* Then simply run ```node web.js``` and BAM! You got yourself a webapp. 


Extra
=====

If you want to change which port it is running on, in ```web.js``` change the ```3000``` in ```var port = process.env.PORT || 3000;``` to whichever port you want to run the app on.