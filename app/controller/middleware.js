'use strict';

async function preOperationData(ctx, module, request_id, request_headers,
  request_method, request_url, request_body, response_status,
  response_body, phase, status_code) {
  const userId = request_headers['X-User-Id'];
  const projectId = request_headers['X-Project-Id'];
  const domainId = request_headers['X-Project-Domain-Id'];

  let catalog = [];
  const reg = new RegExp(`^${module}`);
  if (request_headers['X-Service-Catalog']) {
    catalog = JSON.parse(request_headers['X-Service-Catalog']);
    ctx.service.token.formatEndpoint(catalog);
  } else {
    const tokenObj = await ctx.service.token.getToken();
    const projectId = request_headers['X-Tenant-Id'];

    Object.keys(tokenObj.endpoint).forEach(endpointName => {
      if (reg.test(endpointName)) {
        const ob = tokenObj.endpoint[endpointName];
        const list = [];
        Object.keys(ob).forEach(region => {
          list.push({
            publicURL: ob[region].replace(/([0-9,a-f]{20,})/, projectId),
            region: region,
          })
        });
        catalog.push({
          "name": endpointName,
          "endpoints": list
        });
      }
    });
  }
  let targetUrl = null;
  let targetRegion = null;
  let targetPath = '';
  const endpoint = catalog.filter(c => reg.test(c.name));
  endpoint.forEach(endpoint => {
    const endpoints = endpoint.endpoints;
    let found = false;
    endpoints.some(e => {
      const url = new RegExp(e.publicURL.replace(/\/v(\d+)(\.\d+)*(\/)*/, '/v(\\d|\\.)*$3'));
      if (url.test(request_url)) {
        targetUrl = url;
        targetRegion = e.region;
        targetPath = request_url.replace(targetUrl, '').replace(/^\//, '');
        found = true;
        return true;
      }
    });
    return found;
  });

  const pathArray = targetPath.split('/').map(k => k.replace(/^(.*)\-/g, ''));
  if (pathArray.length > 0 && /v(\d)/.test(pathArray[0])) {
    pathArray.shift();
  }
  const service = ctx.service;
  const opt = {
    "module": module,
    "tag": service.utils.tag.fetchTag(pathArray, request_url),
    "region": targetRegion,
    "catalog": catalog,
    "request": request_body,
    "response": response_body,
    "requestUrl": request_url,
    "requestMethod": request_method,
    "userId": userId,
    "projectId": projectId,
    "domainId": domainId,
    "requestId": request_id,
    "responseStatus": response_status,
    "phase": phase,
    "statusCode": status_code,
  };

  if (service && service[module] && service[module][opt.tag]) {
    const f = ctx.service[module][opt.tag][request_method];
    if (typeof f === 'function') {
      await ctx.service[module][opt.tag][request_method](opt);
    }
  } else if (service && service[module] && typeof ctx.service[module][request_method] === 'function') {
    await ctx.service[module][request_method](opt);
  } else {
    await ctx.service.common[request_method](opt);
  }

}

exports.catch = async(ctx) => {
  const req = ctx.request;

  const {
    request_method,
    request_url,
    request_id,
    response_status,
    request_headers,
  } = req.body;

  if (/^\/keystone/.test(req.url) && /\/tokens$/.test(request_url)) {
    ctx.body = 'Done';
    return;
  }
  console.log(req.url, request_method, request_url);
  
  let request_body = req.body.request_body;
  let response_body = req.body.response_text;
  try {
    request_body = JSON.parse(request_body);
  } catch (e) {

  }



  try {
    response_body = JSON.parse(response_body);
  } catch (e) {

  }
  const o = {
    request_method,
    request_body,
    request_url,
    request_id,
    response_status,
  };
  const module = ctx.params.module;
  // try {
  if (o.response_status) {
    const statusCode = parseInt(o.response_status, 10);
    await preOperationData(ctx, module, request_id, request_headers,
      request_method, request_url, request_body, response_status, response_body, 'after', statusCode);
  } else {
    await preOperationData(ctx, module, request_id, request_headers,
      request_method, request_url, request_body, response_status, response_body, 'before');
  }

  ctx.body = 'Done';
}