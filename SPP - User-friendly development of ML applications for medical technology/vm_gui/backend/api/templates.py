from backend.services.argo_client import load_token, get_workflow_template, get_all_template_names, extract_available_entrypoints, get_template_details_logic
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def list_templates_endpoint(request):
    """
    Fetch all Argo templates to initialize the frontend Sidebar.

    Returns a list of templates including names, available entrypoints, 
    and their default entrypoint.

    Args:
        request: Django REST framework request object (GET).

    Returns:
        Response: JSON list with template names and entrypoint data.
    """
    token = load_token()
    names = get_all_template_names(token)
    
    response_data = []
    
    for name in names:
        wf = get_workflow_template(token, name)
        
        entrypoints = extract_available_entrypoints(wf)
        default_entrypoint = wf.get('spec', {}).get('entrypoint', entrypoints[0] if entrypoints else None)

        response_data.append({
            "name": name,               # "tp-time-series-scaling"
            "entrypoints": entrypoints, # ["fit", "transform", "inverse"]
            "default_entrypoint": default_entrypoint
        })
        
    return Response(response_data)


@api_view(['GET'])
def get_template_details_endpoint(request):
    """
    Returns parameters, artifacts, and outputs for a specific Argo template entrypoint.
    
    This endpoint is called by the Properties Panel to build the configuration form 
    whenever a user selects a node or changes its entrypoint.

    Args:
        request: Request with 'name' and 'entrypoint' query params.

    Returns:
        Response: JSON object containing 'parameters', 'artifacts', and 'outputs'.
    """
    token = load_token()
    
    # lesen
    template_name = request.query_params.get('name')
    selected_entrypoint = request.query_params.get('entrypoint')
    
    if not template_name or not selected_entrypoint:
        return Response({"error": "Missing 'name' or 'entrypoint' params"}, status=400)

    try:
        # 1. raw Yaml
        wf = get_workflow_template(token, template_name)
        
        # 2. extract details (nur vom gewuenschet entrypoint)
        details = get_template_details_logic(wf, selected_entrypoint)
        
        if not details:
            return Response({"error": f"Entrypoint '{selected_entrypoint}' not found in '{template_name}'"}, status=404)
            
        return Response(details)
        #parameters, artifacts, outputs
        
    except Exception as e:
        print(f"Error in get_template_details_endpoint: {e}")
        return Response({"error": str(e)}, status=500)