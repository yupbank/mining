#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
import memcache

import tornado.ioloop
import tornado.web
import tornado.gen
import tornado.autoreload
from tornado.websocket import WebSocketHandler

from pandas import DataFrame

from .utils import df_generate
from .models import MyBucket, MyAdminBucket, MyCache


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        dashboard = MyAdminBucket.get('dashboard').data

        self.render('index.html', dashboard=dashboard or [])


class DashboardHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    def get(self, slug):

        get_bucket = MyAdminBucket.get('dashboard').data or []

        elements = {}
        for d in get_bucket:
            if d['slug'] == slug:
                elements['slug'] = slug

                # GET ELEMENT
                _e = []
                for dash_element in d['element']:
                    element = MyAdminBucket.get('element').data
                    for e in element:
                        if dash_element == e['slug']:
                            try:
                                e['_type'] = e['type'].split('_')[1]
                            except:
                                e['_type'] = None
                            _e.append(e)
                    elements = _e

        self.render('dashboard.html', elements=elements, dashboard=get_bucket)


class ProcessWebSocket(WebSocketHandler):
    @tornado.web.asynchronous
    @tornado.gen.engine
    def open(self, slug):
        columns = json.loads(MyBucket.get('{}-columns'.format(slug)).data)
        fields = columns
        if self.get_argument('fields', None):
            fields = self.get_argument('fields').split(',')

        self.write_message({'type': 'columns', 'data': fields})

        filters = [i[0] for i in self.request.arguments.iteritems()
                   if len(i[0].split('filter__')) > 1]

        df = DataFrame(MyBucket.get(slug).data, columns=fields)
        if len(filters) >= 1:
            for f in filters:
                df = df.query(df_generate(df, self.get_argument, f))

        ca = None
        for e in MyAdminBucket.get('element').data:
            if e['slug'] == slug:
                ca = e['categories']

        categories = []
        for i in df.to_dict(outtype='records'):
            if ca:
                categories.append(i[ca])
            self.write_message({'type': 'data', 'data': i})

        self.write_message({'type': 'categories', 'data': categories})
        self.write_message({'type': 'close'})


class ProcessHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    @tornado.gen.engine
    def post(self, slug):
        columns = json.loads(MyBucket.get('{}-columns'.format(slug)).data)
        fields = columns
        if self.get_argument('fields', None):
            fields = self.get_argument('fields').split(',')

        filters = [i[0] for i in self.request.arguments.iteritems()
                   if len(i[0].split('filter__')) > 1]

        fields_json = json.dumps(fields)
        filters_json = json.dumps({f: self.get_argument(f) for f in filters})
        if MyCache.get(str(slug)) and\
                MyCache.get('{}-columns'.format(slug)) == fields_json and\
                MyCache.get('{}-fulters'.format(slug)) == filters_json:
            self.write(MyCache.get(str(slug)))
            self.finish()

        MyCache.set('{}-columns'.format(slug), fields_json)
        MyCache.set('{}-filters'.format(slug), filters_json)

        df = DataFrame(MyBucket.get(slug).data, columns=fields)
        if len(filters) >= 1:
            for f in filters:
                df = df.query(df_generate(df, self.get_argument, f))
        convert = df.to_dict(outtype='records')

        write = json.dumps({'columns': fields, 'json': convert})
        MyCache.set(str(slug), write)
        self.write(write)
        self.finish()
