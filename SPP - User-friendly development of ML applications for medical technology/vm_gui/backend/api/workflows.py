# backend/api/workflows.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from backend.services.argo_client import submit_hera_workflow

@api_view(['POST'])
def submit_workflow(request):
    """
    API endpoint to process and execute the visual workflow graph.

    This view receives the node and edge configuration from the frontend, orchestrates the 
    creation of the Argo Workflow via the Hera SDK, and handles the final response based 
    on the requested action (deployment to cluster or YAML download).

    Args:
        request (Request): A DRF request object containing a JSON body with:
            - **nodes** (*list*): Array of node configurations.
            - **edges** (*list*): Array of connections between nodes.
            - **s3Config** (*dict*): S3 credentials (accessKey, secretKey, endpoint).
            - **action** (*str*): 'submit' (default) or 'download'.

    Returns:
        Response: A JSON object containing:
            - If **submit**: `{"status": "submitted", "workflow_name": "...", "message": "..."}`
            - If **download**: `{"status": "success", "yaml": "..."}`
            - If **error**: `{"error": "..."}` with status 400 or 500.
    """
    try:
        data = request.data     #Hier speichern wir Frontend data
        nodes = data.get('nodes', [])
        edges = data.get('edges', [])

        s3_config = data.get('s3Config')  

        action = data.get('action', 'submit')


        if not nodes:
            return Response({"error": "No nodes provided"}, status=400)

        result = submit_hera_workflow(nodes, edges, s3_config=s3_config, action=action)  #Sende an cluster

        if action == "download":
            # YAML in response nach frontend senden
            return Response({
                "status": "success",
                "yaml": result 
            })

        return Response({
            "status": "submitted", 
            "workflow_name": result,
            "message": "Workflow an cluster gesendet."
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)