/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');
const recursive = require('recursive-readdir');


const index = new FlexSearch();

index.add(10025, 'John Doe');

const result = await index.search(query);

// pagination

const result = await index.search(query, {limit: 5, page: true});

{
    'page': 'xxx:xxx',
    'next': 'xxx:xxx',
    'result': []
}

const result = await index.search(query, {limit: 5, page: response.next});

// suggestions
const result = await index.search(query, {suggest: true});

// information
var length = index.length;
DEBUG = true;
index.info(); // in DEBUG mode

// Multiple docs

index.add(docs);

var index = new FlexSearch({
    tokenize: 'strict',
    depth: 3,
    doc: {
        id: 'id',
        field: 'content'
    }
});

// Export and import

localStorage.setItem("feeds_2017", feeds_2017.export());
feeds_2017.import(localStorage.getItem("feeds_2017"));


// Multiple fields

field: [
            'title',
            'cat',
            'content'
        ]

doc: {
  id: 'data:id',
  field: [
    'data:title',
    'data:body:content'
  ]
}

// Field search

var results = index.search({
    field: "title",
    query: "foobar"
});

// or

var results = index.search("foobar", {
    field: "data:body:content",
});

// or for multiple field search

var results = index.search({
    query: "foobar",
    field: ["title", "body"],
    bool: "or"
});

// different queries on different fields

var results = index.search([{
    field: "title",
    query: "foo"
},{
    field: "body",
    query: "bar"
}]);


// find by attribute

index.find({"cat": "comedy"});
index.where({"cat": "comedy"});

// custom function

index.where(function(item){
    return item.cat === "comedy";
});

// with limit

index.where({
    cat: "comedy",
    year: "2018"
 }, 100);

// custom sort

var results = index.search("John", {

    limit: 100,
    sort: function(a, b){
        return (
            a.id < b.id ? -1 : (
                a.id > b.id ? 1 : 0
        ));
    }
});

// with Worker

var index = new FlexSearch({

    encode: "icase",
    tokenize: "full",
    async: true,
    worker: 4
});